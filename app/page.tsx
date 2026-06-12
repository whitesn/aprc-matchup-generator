"use client";

import { useEffect, useMemo, useState } from "react";
import { ScheduleData, CompletedData } from "@/models/schedules";

type PlayableTable = {
  hanchanId: number;
  tableNo: number;
  players: number[];
};

export default function Home() {
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);

  const [completedData, setCompletedData] = useState<CompletedData | null>(
    null,
  );

  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/schedules.json").then((r) => r.json()),
      fetch("/completed.json").then((r) => r.json()),
    ]).then(([schedule, completed]) => {
      setScheduleData(schedule);
      setCompletedData(completed);
    });
  }, []);

  const participantMap = useMemo(() => {
    if (!scheduleData) return {};

    return Object.fromEntries(
      scheduleData.participants.map((p) => [p.id, p.name]),
    ) as Record<number, string>;
  }, [scheduleData]);

  const completedLookup = useMemo(() => {
    const lookup = new Set<string>();

    if (!completedData) {
      return lookup;
    }

    completedData.hanchans.forEach((h) => {
      h.tables.forEach((tableNo) => {
        lookup.add(`${h.id}-${tableNo}`);
      });
    });

    return lookup;
  }, [completedData]);

  const playableTables = useMemo<PlayableTable[]>(() => {
    if (!scheduleData) return [];

    return scheduleData.hanchans.flatMap((hanchan) =>
      hanchan.tables
        .map((table, index) => ({
          hanchanId: hanchan.id,
          tableNo: index + 1,
          players: table,
        }))
        .filter((table) => {
          const playable = table.players.every((playerId) =>
            selectedPlayers.includes(playerId),
          );

          const completed = completedLookup.has(
            `${table.hanchanId}-${table.tableNo}`,
          );

          return playable && !completed;
        }),
    );
  }, [scheduleData, selectedPlayers, completedLookup]);

  const concurrentSets = useMemo(() => {
    const tablesNeeded = Math.floor(selectedPlayers.length / 4);

    if (tablesNeeded < 2) {
      return [];
    }

    const results: PlayableTable[][] = [];

    function hasOverlap(currentSet: PlayableTable[], candidate: PlayableTable) {
      const usedPlayers = new Set(currentSet.flatMap((table) => table.players));

      return candidate.players.some((p) => usedPlayers.has(p));
    }

    function backtrack(startIndex: number, currentSet: PlayableTable[]) {
      if (currentSet.length === tablesNeeded) {
        results.push([...currentSet]);
        return;
      }

      for (let i = startIndex; i < playableTables.length; i++) {
        const table = playableTables[i];

        if (hasOverlap(currentSet, table)) {
          continue;
        }

        currentSet.push(table);

        backtrack(i + 1, currentSet);

        currentSet.pop();
      }
    }

    backtrack(0, []);

    return results.slice(0, 100);
  }, [playableTables, selectedPlayers.length]);

  const playerMatchCounts = useMemo(() => {
    if (!scheduleData) return [];

    const counts = new Map<number, number>();

    scheduleData.participants.forEach((p) => {
      counts.set(p.id, 0);
    });

    scheduleData.hanchans.forEach((hanchan) => {
      hanchan.tables.forEach((table, index) => {
        const tableNo = index + 1;

        const isCompleted = completedLookup.has(`${hanchan.id}-${tableNo}`);

        if (!isCompleted) {
          return;
        }

        table.forEach((playerId) => {
          counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
        });
      });
    });

    return [...counts.entries()]
      .map(([playerId, matchCount]) => ({
        playerId,
        playerName: participantMap[playerId],
        matchCount,
      }))
      .sort(
        (a, b) =>
          b.matchCount - a.matchCount ||
          a.playerName.localeCompare(b.playerName),
      );
  }, [scheduleData, completedLookup, participantMap]);

  if (!scheduleData || !completedData) {
    return <main className="p-6">Loading...</main>;
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">APRC Matchup Generator</h1>

      <h2 className="text-xl font-semibold mb-4">Available Players</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
        {scheduleData.participants.map((player) => (
          <label
            key={player.id}
            className="border rounded p-2 flex items-center gap-2"
          >
            <input
              type="checkbox"
              checked={selectedPlayers.includes(player.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedPlayers((prev) => [...prev, player.id]);
                } else {
                  setSelectedPlayers((prev) =>
                    prev.filter((id) => id !== player.id),
                  );
                }
              }}
            />

            {player.name}
          </label>
        ))}
      </div>

      <div className="mb-4">Selected Players: {selectedPlayers.length}</div>

      <div className="mb-8">Playable Tables: {playableTables.length}</div>

      <h2 className="text-xl font-semibold mb-4">Playable Tables</h2>

      <div className="space-y-3 mb-10">
        {playableTables.map((table) => (
          <div
            key={`${table.hanchanId}-${table.tableNo}`}
            className="border rounded p-4"
          >
            <div className="font-semibold">
              Hanchan {table.hanchanId}
              {" - "}
              Table {table.tableNo}
            </div>

            <div className="mt-2">
              {table.players.map((id) => participantMap[id]).join(", ")}
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-4">Concurrent Sets</h2>

      <div className="mb-4">Found {concurrentSets.length} possible sets</div>

      <div className="space-y-4">
        {concurrentSets.map((set, index) => (
          <div key={index} className="border rounded p-4">
            <div className="font-semibold mb-2">Set #{index + 1}</div>

            {set.map((table) => (
              <div key={`${table.hanchanId}-${table.tableNo}`}>
                Hanchan {table.hanchanId}
                {" - "}
                Table {table.tableNo}
                {" : "}
                {table.players.map((id) => participantMap[id]).join(", ")}
              </div>
            ))}
          </div>
        ))}
      </div>
      <h2 className="text-xl font-semibold mt-12 mb-4">Schedule Overview</h2>

      <div className="overflow-x-auto">
        <table className="border-collapse border">
          <thead>
            <tr>
              <th className="border p-2">Hanchan</th>

              <th className="border p-2">Table 1</th>

              <th className="border p-2">Table 2</th>

              <th className="border p-2">Table 3</th>

              <th className="border p-2">Table 4</th>
            </tr>
          </thead>

          <tbody>
            {scheduleData.hanchans.map((hanchan) => (
              <tr key={hanchan.id}>
                <td className="border p-2 font-bold">Hanchan {hanchan.id}</td>

                {hanchan.tables.map((table, index) => {
                  const tableNo = index + 1;

                  const isCompleted = completedLookup.has(
                    `${hanchan.id}-${tableNo}`,
                  );

                  return (
                    <td
                      key={tableNo}
                      className={`border p-2 align-top ${
                        isCompleted ? "bg-yellow-600" : ""
                      }`}
                    >
                      {table
                        .map((playerId) => `${participantMap[playerId]}`)
                        .join(" , ")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-semibold mt-12 mb-4">Player Match Counts</h2>

      <table className="border-collapse border w-full">
        <thead>
          <tr>
            <th className="border p-2 text-left">Player</th>
            <th className="border p-2 text-left">Match Count</th>
          </tr>
        </thead>

        <tbody>
          {playerMatchCounts.map((player) => (
            <tr key={player.playerId}>
              <td className="border p-2">{player.playerName}</td>

              <td className="border p-2">{player.matchCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
