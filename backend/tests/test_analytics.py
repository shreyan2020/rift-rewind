from __future__ import annotations

import unittest

from backend.analytics import GameSnapshot, VALUE_NAMES, build_season_analysis, divide_into_periods


def game(index: int, *, improving: bool = False) -> GameSnapshot:
    lift = index * 5 if improving else 0
    return GameSnapshot(
        match_id=f"M{index}", timestamp_ms=1_700_000_000_000 + index * 1000,
        duration_min=30, win=index % 2 == 0, champion="Nami" if index < 6 else "Thresh", role="SUPPORT",
        kills=2, deaths=max(1, 6 - index // 3), assists=10 + index, kda=2.0 + index * 0.2,
        cs_per_min=1.1, early_cs_per_min=1.0, gold_per_min=290 + lift,
        vision_per_min=1.2 + index * 0.1, kill_participation=0.5 + index * 0.02,
        damage_per_min=300 + lift, damage_taken_per_min=400, objective_damage_per_min=60 + lift,
        control_wards=2 + index * 0.1, wards_placed=20, wards_killed=5, solo_kills=0,
        first_blood=1 if index == 0 else 0, multikills=0, objective_steals=0,
        crowd_control=10, pings_per_min=2,
    )


class AnalyticsTests(unittest.TestCase):
    def test_periods_are_equal_and_chronological(self) -> None:
        games = [game(index) for index in reversed(range(8))]
        periods = divide_into_periods(games)
        self.assertEqual([len(period) for period in periods], [2, 2, 2, 2])
        self.assertLess(periods[0][0].timestamp_ms, periods[-1][-1].timestamp_ms)

    def test_scores_are_comparable_zero_to_one_hundred(self) -> None:
        result = build_season_analysis([game(index, improving=True) for index in range(12)])
        for period in result["periods"]:
            self.assertEqual(set(period["values"]), set(VALUE_NAMES))
            self.assertTrue(all(0 <= score <= 100 for score in period["values"].values()))
            self.assertEqual(len(period["top_values"]), 3)

    def test_journey_has_four_grounded_waypoints(self) -> None:
        result = build_season_analysis([game(index, improving=True) for index in range(12)])
        route = result["finale"]["journey_map"]
        self.assertEqual(len(route), 4)
        self.assertEqual([item["quarter"] for item in route], ["Q1", "Q2", "Q3", "Q4"])
        self.assertTrue(all(item["trigger"] and item["evidence"] for item in route))


if __name__ == "__main__":
    unittest.main()
