"""
Unit tests for RaceGuard Detection Engine
"""

from detector import RaceDetector
from scenarios import SCENARIOS, get_scenario

def test_counter_buggy():
    sc = get_scenario("counter", is_fixed=False)
    detector = RaceDetector(sc["events"])
    res = detector.analyze()
    print("--- Counter++ Buggy ---")
    print("Total races:", res["summary"]["total_races"])
    print("Critical count:", res["summary"]["critical_count"])
    assert res["summary"]["total_races"] > 0
    assert res["summary"]["critical_count"] > 0
    print("PASSED Counter Buggy Test!")

def test_counter_fixed():
    sc = get_scenario("counter", is_fixed=True)
    detector = RaceDetector(sc["events"])
    res = detector.analyze()
    print("--- Counter++ Fixed ---")
    print("Total races:", res["summary"]["total_races"])
    assert res["summary"]["total_races"] == 0
    print("PASSED Counter Fixed Test!")

def test_bank_transfer():
    buggy = RaceDetector(get_scenario("bank_transfer", False)["events"]).analyze()
    fixed = RaceDetector(get_scenario("bank_transfer", True)["events"]).analyze()
    print("--- Bank Transfer ---")
    print("Buggy races:", buggy["summary"]["total_races"], "Fixed races:", fixed["summary"]["total_races"])
    assert buggy["summary"]["total_races"] > 0
    assert fixed["summary"]["total_races"] == 0
    print("PASSED Bank Transfer Test!")

if __name__ == "__main__":
    test_counter_buggy()
    test_counter_fixed()
    test_bank_transfer()
    print("\nALL DETECTOR UNIT TESTS PASSED SUCCESSFULLY!")
