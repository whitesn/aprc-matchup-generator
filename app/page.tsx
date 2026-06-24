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

  const sessions = useMemo(() => {
    const remaining = [...playableTables];

    const allSessions: PlayableTable[][] = [];

    while (remaining.length > 0) {
      let best: PlayableTable[] = [];

      function dfs(index: number, current: PlayableTable[], used: Set<number>) {
        if (current.length > best.length) {
          best = [...current];
        }

        for (let i = index; i < remaining.length; i++) {
          const table = remaining[i];

          const overlap = table.players.some((p) => used.has(p));

          if (overlap) continue;

          const nextUsed = new Set(used);

          table.players.forEach((p) => nextUsed.add(p));

          current.push(table);

          dfs(i + 1, current, nextUsed);

          current.pop();
        }
      }

      dfs(0, [], new Set());

      if (best.length === 0) {
        break;
      }

      allSessions.push(best);

      const usedKeys = new Set(best.map((t) => `${t.hanchanId}-${t.tableNo}`));

      for (let i = remaining.length - 1; i >= 0; i--) {
        const key = `${remaining[i].hanchanId}-${remaining[i].tableNo}`;

        if (usedKeys.has(key)) {
          remaining.splice(i, 1);
        }
      }
    }

    return allSessions;
  }, [playableTables]);

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

      <div className="flex gap-2 mb-4 justify-end">
        <button
          onClick={() => setSelectedPlayers([])}
          className="px-4 py-2 border rounded bg-red-600 hover:bg-gray-100"
        >
          ❌ Clear Selection
        </button>
      </div>

      <div className="mb-4">Selected Players: {selectedPlayers.length}</div>

      <div className="mb-8">Playable Tables: {playableTables.length}</div>

      <details className="mb-8">
        <summary className="text-xl font-semibold cursor-pointer mb-4">
          Playable Tables ({playableTables.length})
        </summary>

        <div className="space-y-3 mt-4">
          {playableTables.map((table) => (
            <div
              key={`${table.hanchanId}-${table.tableNo}`}
              className="border rounded p-4"
            >
              <div className="font-semibold">
                Hanchan {table.hanchanId} - Table {table.tableNo}
              </div>

              <div className="mt-2">
                {table.players.map((id) => participantMap[id]).join(", ")}
              </div>
            </div>
          ))}
        </div>
      </details>

      <h2 className="text-xl font-semibold mb-4">Suggested Sessions</h2>

      <div className="space-y-4">
        {sessions.map((session, index) => (
          <div key={index} className="border rounded p-4">
            <div className="font-semibold mb-2">
              Session {index + 1}
              {" ("}
              {session.length}
              {" tables)"}
            </div>

            {session.map((table) => (
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
