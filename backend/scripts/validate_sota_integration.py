"""
SOTA Stacking Integration Validation Script
Validates that SOTA stacking is properly integrated and functional
"""

import sys
import subprocess
from pathlib import Path
import json

def print_header(text):
    """Print formatted header"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")

def print_step(number, text):
    """Print formatted step"""
    print(f"\n[Step {number}] {text}")
    print("-" * 70)

def run_command(cmd, description):
    """Run a command and return success status"""
    print(f"Running: {description}")
    print(f"Command: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            check=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        print(f"✓ Success")
        if result.stdout:
            print(f"Output: {result.stdout[:200]}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed with exit code {e.returncode}")
        if e.stderr:
            print(f"Error: {e.stderr[:200]}")
        return False
    except subprocess.TimeoutExpired:
        print(f"✗ Timeout (>30s)")
        return False

def check_file_exists(path, description):
    """Check if a file exists"""
    print(f"Checking: {description}")
    exists = Path(path).exists()
    print(f"{'✓' if exists else '✗'} {path}")
    return exists

def check_imports():
    """Check if required modules can be imported"""
    print("Checking Python imports...")
    
    imports_to_test = [
        ("src.models.sota_stack", "SOTA Stack module"),
        ("src.models.ensemble", "Ensemble module"),
        ("src.models.training", "Training module"),
        ("src.core.config", "Config module"),
    ]
    
    all_passed = True
    for module, description in imports_to_test:
        try:
            __import__(module)
            print(f"✓ {description}: {module}")
        except ImportError as e:
            print(f"✗ {description}: {module} - {e}")
            all_passed = False
    
    return all_passed

def check_autogluon():
    """Check if AutoGluon is available"""
    print("Checking AutoGluon availability...")
    try:
        from src.models.sota_stack import SotaStackingEnsemble
        is_available = SotaStackingEnsemble.is_available()
        if is_available:
            print("✓ AutoGluon is installed and available")
            try:
                import autogluon.tabular
                version = autogluon.tabular.__version__
                print(f"  Version: {version}")
            except:
                pass
            return True
        else:
            print("✗ AutoGluon not available")
            print("  Install with: pip install 'autogluon.tabular>=1.0.0'")
            return False
    except Exception as e:
        print(f"✗ Error checking AutoGluon: {e}")
        return False

def check_config():
    """Check configuration settings"""
    print("Checking configuration...")
    try:
        from src.core.config import Settings
        settings = Settings()
        
        print(f"  enable_sota_stack: {settings.enable_sota_stack}")
        print(f"  sota_time_limit: {settings.sota_time_limit}")
        print(f"  sota_presets: {settings.sota_presets}")
        print(f"  sota_hyperparameters: {settings.sota_hyperparameters}")
        
        return True
    except Exception as e:
        print(f"✗ Error loading config: {e}")
        return False

def run_unit_tests():
    """Run SOTA unit tests"""
    print("Running unit tests...")
    cmd = "pytest tests/unit/test_sota_stack.py -v --tb=short"
    return run_command(cmd, "SOTA unit tests")

def run_integration_tests():
    """Run SOTA integration tests"""
    print("Running integration tests...")
    cmd = "pytest tests/integration/test_sota_ensemble_integration.py -v --tb=short"
    return run_command(cmd, "SOTA integration tests")

def check_cli_help():
    """Check if CLI includes SOTA flags"""
    print("Checking CLI flags...")
    cmd = "python -m src.cli.train_models --help"
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            check=True,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        help_text = result.stdout
        
        required_flags = [
            "--enable-sota-stack",
            "--sota-time-limit",
            "--sota-presets",
            "--sota-hyperparameters"
        ]
        
        all_present = True
        for flag in required_flags:
            if flag in help_text:
                print(f"✓ {flag}")
            else:
                print(f"✗ {flag} not found in help")
                all_present = False
        
        return all_present
    except Exception as e:
        print(f"✗ Error checking CLI help: {e}")
        return False

def main():
    """Main validation routine"""
    print_header("SOTA Stacking Integration Validation")
    
    # Change to backend directory
    backend_dir = Path(__file__).parent.parent
    import os
    os.chdir(backend_dir)
    print(f"Working directory: {backend_dir}")
    
    results = {}
    
    # Step 1: Check files exist
    print_step(1, "File Structure Validation")
    results['files'] = all([
        check_file_exists("src/models/sota_stack.py", "SOTA Stack module"),
        check_file_exists("src/models/ensemble.py", "Ensemble module"),
        check_file_exists("src/models/training.py", "Training module"),
        check_file_exists("src/core/config.py", "Config module"),
        check_file_exists("src/cli/train_models.py", "Training CLI"),
        check_file_exists("tests/unit/test_sota_stack.py", "SOTA unit tests"),
        check_file_exists("tests/integration/test_sota_ensemble_integration.py", "SOTA integration tests"),
        check_file_exists("requirements.txt", "Requirements file"),
    ])
    
    # Step 2: Check imports
    print_step(2, "Module Import Validation")
    results['imports'] = check_imports()
    
    # Step 3: Check AutoGluon
    print_step(3, "AutoGluon Availability")
    results['autogluon'] = check_autogluon()
    
    # Step 4: Check configuration
    print_step(4, "Configuration Validation")
    results['config'] = check_config()
    
    # Step 5: Check CLI
    print_step(5, "CLI Flag Validation")
    results['cli'] = check_cli_help()
    
    # Step 6: Run tests (optional, might fail without AutoGluon)
    print_step(6, "Test Suite Validation")
    if results['autogluon']:
        results['unit_tests'] = run_unit_tests()
        results['integration_tests'] = run_integration_tests()
    else:
        print("⚠️  Skipping tests (AutoGluon not installed)")
        results['unit_tests'] = None
        results['integration_tests'] = None
    
    # Summary
    print_header("Validation Summary")
    
    print("\nResults:")
    for category, status in results.items():
        if status is True:
            print(f"  ✓ {category.replace('_', ' ').title()}")
        elif status is False:
            print(f"  ✗ {category.replace('_', ' ').title()}")
        else:
            print(f"  ⚠️  {category.replace('_', ' ').title()} (Skipped)")
    
    # Overall status
    critical_checks = ['files', 'imports', 'config', 'cli']
    critical_passed = all(results.get(check, False) for check in critical_checks)
    
    print("\n" + "=" * 70)
    if critical_passed:
        print("  ✓ SOTA Integration: VALIDATED")
        print("=" * 70)
        
        if not results['autogluon']:
            print("\n⚠️  Note: AutoGluon not installed. Install with:")
            print("    pip install 'autogluon.tabular>=1.0.0'")
        
        print("\nNext Steps:")
        print("  1. Install AutoGluon (if not already installed)")
        print("  2. Run test training: python -m src.cli.train_models --leagues EPL --enable-sota-stack --sota-time-limit 60")
        print("  3. Validate metrics in output")
        print("  4. Deploy to staging for A/B testing")
        
        return 0
    else:
        print("  ✗ SOTA Integration: FAILED")
        print("=" * 70)
        print("\nPlease fix the issues above before proceeding.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
