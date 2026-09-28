"""Run trusted SQLite behavior tests and emit a complete structured inventory."""
import importlib.util
import json
from pathlib import Path
import sys
import traceback
import unittest

spec = importlib.util.spec_from_file_location('behavior_tests', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Results(unittest.TestResult):
    def __init__(self):
        super().__init__()
        self.states = {}

    def addSuccess(self, test):
        super().addSuccess(test)
        self.states[test.id()] = 'passed'

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self.states[test.id()] = 'failed'

    def addError(self, test, err):
        super().addError(test, err)
        self.states[test.id()] = 'failed'

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self.states[test.id()] = 'skipped'


def test_ids(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from test_ids(test)
        else:
            yield test.id()


suite = unittest.defaultTestLoader.loadTestsFromModule(module)
expected = list(test_ids(suite))
result = Results()
suite.run(result)
for test, trace in result.errors + result.failures:
    print(test.id(), trace, file=sys.stderr)
complete = (bool(expected) and len(set(expected)) == len(expected)
            and result.testsRun == len(expected) and set(result.states) == set(expected))
report = {'valid': complete, 'tests': result.states, 'expected_tests': expected,
          'complete_test_inventory': complete, 'tests_run': result.testsRun,
          'exit_code': 0 if complete and result.wasSuccessful() else 1}
Path(sys.argv[2]).write_text(json.dumps(report, indent=2) + '\n')
sys.exit(report['exit_code'])
