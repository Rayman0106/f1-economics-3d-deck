"""Build the offline presentation with the organized source tree."""
from pathlib import Path
import runpy, sys
tools=Path(__file__).resolve().parent/'tools'
sys.path.insert(0,str(tools))
runpy.run_path(str(tools/'build.py'),run_name='__main__')
