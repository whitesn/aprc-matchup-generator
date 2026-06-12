export interface Participant {
  id: number;
  name: string;
}

export interface Hanchan {
  id: number;
  tables: number[][];
}

export interface ScheduleData {
  participants: Participant[];
  hanchans: Hanchan[];
}

export interface CompletedData {
  hanchans: {
    id: number;
    tables: number[];
  }[];
}
