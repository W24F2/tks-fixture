#!/usr/bin/env python3
import unittest
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

if __name__ == '__main__':
    # Discover and run tests
    loader = unittest.TestLoader()
    start_dir = 'tests'
    suite = loader.discover(start_dir)
    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)