#!/usr/bin/env python3
"""
Package journey files into a single JSON for frontend upload
"""

import json
import os
import sys
from pathlib import Path

def package_journey(journey_folder: str, output_file: str = "journey-package.json"):
    """Combine all journey files into a single uploadable JSON"""
    
    journey_path = Path(journey_folder)
    
    if not journey_path.exists():
        print(f"❌ Error: Journey folder '{journey_folder}' not found")
        sys.exit(1)
    
    print(f"📦 Packaging journey from '{journey_folder}'...")
    
    # Load metadata
    metadata_path = journey_path / "metadata.json"
    if not metadata_path.exists():
        print(f"❌ Error: metadata.json not found")
        sys.exit(1)
    
    with open(metadata_path, 'r', encoding='utf-8') as f:
        metadata = json.load(f)
    
    # Load quarters
    quarters = {}
    for q in ["Q1", "Q2", "Q3", "Q4"]:
        story_path = journey_path / q / "story.json"
        if not story_path.exists():
            print(f"⚠️  Warning: {q}/story.json not found, skipping")
            continue
        
        with open(story_path, 'r', encoding='utf-8') as f:
            quarters[q] = json.load(f)
        print(f"   ✓ Loaded {q}")
    
    # Load finale
    finale_path = journey_path / "finale.json"
    if not finale_path.exists():
        print(f"⚠️  Warning: finale.json not found")
        finale = None
    else:
        with open(finale_path, 'r', encoding='utf-8') as f:
            finale = json.load(f)
        print(f"   ✓ Loaded finale")
    
    # Create complete package
    package = {
        "metadata": metadata,
        "quarters": quarters,
        "finale": finale,
        "version": "1.0",
        "type": "complete-journey"
    }
    
    # Write output
    output_path = Path(output_file)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(package, f, indent=2, ensure_ascii=False)
    
    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    
    print(f"\n✅ Package created successfully!")
    print(f"   📄 File: {output_file}")
    print(f"   📊 Size: {file_size_mb:.2f} MB")
    print(f"   🎮 Games: {metadata['totalGames']}")
    print(f"   📅 Quarters: {len(quarters)}")
    print(f"\n📤 Upload this file in the frontend!")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Package journey for frontend upload')
    parser.add_argument('journey_folder', help='Journey folder (e.g., my-journey)')
    parser.add_argument('--output', '-o', default='journey-package.json',
                        help='Output file name (default: journey-package.json)')
    
    args = parser.parse_args()
    
    package_journey(args.journey_folder, args.output)
