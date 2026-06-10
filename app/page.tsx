"use client";

import { useEffect, useMemo, useState } from "react";
import { ScheduleData } from "@/models/schedule";

type PlayableTable = {
  hanchanId: number;
  tableNo: number;
  players: number[];
};

export default function Home() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);

  useEffect(() => {
    fetch("/schedules.json")
      .then((res) => res.json())
      .then((json: ScheduleData) => {
        setData(json);
      });
  }, []);

  const participantMap = useMemo(() => {
    if (!data) return {};

    return Object.fromEntries(
      data.participants.map((p) => [p.id, p.name]),
    ) as Record<number, string>;
  }, [data]);

  const playableTables = useMemo<PlayableTable[]>(() => {
    if (!data) return [];

    return data.hanchans.flatMap((hanchan) =>
      hanchan.tables
        .map((table, index) => ({
          hanchanId: hanchan.id,
          tableNo: index + 1,
          players: table,
        }))
        .filter((table) =>
          table.players.every((playerId) => selectedPlayers.includes(playerId)),
        ),
    );
  }, [data, selectedPlayers]);

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

    return results;
  }, [playableTables, selectedPlayers]);

  if (!data) {
    return (
      <main className="p-6">
        <div>Loading schedules...</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">APRC Scheduler</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
        {data.participants.map((player) => (
          <label
            key={player.id}
            className="flex items-center gap-2 border rounded p-2"
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

            <span>{player.name}</span>
          </label>
        ))}
      </div>

      <div className="mb-6">
        <strong>Selected Players:</strong> {selectedPlayers.length}
      </div>

      <div className="mb-4">
        <strong>Playable Tables:</strong> {playableTables.length}
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">Concurrent Sets</h2>

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

        <div className="mt-10"></div>
        <h2 className="text-2xl font-bold mb-4">Playable Tables</h2>

        <div className="space-y-3">
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
      </div>
    </main>
  );
}
