import {
  canDeleteDailyHistoryRecord,
  groupRawHistoryByDay,
  normalizeDailyHistory,
} from "./waterTwinUtils";

describe("waterTwinUtils", () => {
  test("only real daily history records are deletable", () => {
    const [dailyRecord] = normalizeDailyHistory([
      {
        _id: "6899f9f9f9f9f9f9f9f9f9f9",
        camera_id: "cam_1",
        date: "2026-08-12",
        average_level: 7.55,
        maximum_level: 10.15,
        minimum_level: 6.2,
        latest_level: 9.91,
        latest_status: "DANGER",
        latest_timestamp: "2026-08-12T03:35:00.000Z",
        reading_count: 6,
      },
    ]);

    const [groupedRecord] = groupRawHistoryByDay([
      {
        camera_id: "cam_1",
        water_level: 9.91,
        status: "DANGER",
        timestamp: "2026-08-12T03:35:00.000Z",
      },
    ]);

    expect(canDeleteDailyHistoryRecord(dailyRecord)).toBe(true);
    expect(canDeleteDailyHistoryRecord(groupedRecord)).toBe(false);
  });
});
