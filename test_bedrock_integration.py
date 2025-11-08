#!/usr/bin/env python3
"""
Test the full Bedrock integration with realistic data
"""
import sys
import os

# Add infra/src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'infra', 'src'))

from bedrock_lore import (
    generate_quarter_lore,
    generate_quarter_reflection,
    generate_finale_lore,
    generate_finale_reflection
)

def test_quarter_lore():
    print("=" * 60)
    print("TEST 1: Quarter Lore Generation")
    print("=" * 60)
    
    stats = {
        'games': 50,
        'kda_proxy': 2.5,
        'cs_per_min': 5.2,
        'vision_score_per_min': 1.8,
        'gold_per_min': 350,
        'ping_rate_per_min': 2.1
    }
    
    top_values = [
        ("Benevolence", 85.3),
        ("Security", 72.1),
        ("Achievement", 68.5),
        ("Power", 55.2),
        ("Universalism", 51.8)
    ]
    
    lore = generate_quarter_lore("Q1", stats, top_values, "Demacia")
    
    print(f"\nRegion: Demacia")
    print(f"Top Values: {', '.join([v[0] for v in top_values[:3]])}")
    print(f"\nGenerated Lore:")
    print("-" * 60)
    print(lore)
    print("-" * 60)
    return lore

def test_quarter_reflection():
    print("\n" + "=" * 60)
    print("TEST 2: Quarter Reflection Generation")
    print("=" * 60)
    
    stats = {
        'games': 50,
        'kda_proxy': 2.5,
        'cs_per_min': 4.1,  # Low - should be flagged
        'vision_score_per_min': 1.8,
        'gold_per_min': 350,
        'ping_rate_per_min': 2.1
    }
    
    top_values = [
        ("Benevolence", 85.3),
        ("Security", 72.1),
        ("Achievement", 68.5)
    ]
    
    reflection = generate_quarter_reflection("Q1", stats, top_values)
    
    print(f"\nStats: {stats['games']} games, {stats['kda_proxy']:.2f} KDA, {stats['cs_per_min']:.2f} CS/min")
    print(f"\nGenerated Reflection:")
    print("-" * 60)
    print(reflection)
    print("-" * 60)
    return reflection

def test_finale_lore():
    print("\n" + "=" * 60)
    print("TEST 3: Finale Lore Generation")
    print("=" * 60)
    
    all_quarters = [
        {
            'region_arc': 'Demacia',
            'top_values': [('Benevolence', 85.3), ('Security', 72.1)],
            'stats': {'games': 50, 'kda_proxy': 2.5}
        },
        {
            'region_arc': 'Noxus',
            'top_values': [('Power', 88.1), ('Achievement', 75.2)],
            'stats': {'games': 55, 'kda_proxy': 2.8}
        },
        {
            'region_arc': 'Ionia',
            'top_values': [('Self-Direction', 80.5), ('Universalism', 71.3)],
            'stats': {'games': 48, 'kda_proxy': 2.6}
        },
        {
            'region_arc': 'Piltover',
            'top_values': [('Achievement', 91.2), ('Stimulation', 78.5)],
            'stats': {'games': 52, 'kda_proxy': 3.1}
        }
    ]
    
    lore = generate_finale_lore(all_quarters, "Summoner", 205)
    
    print(f"\nJourney: Demacia → Noxus → Ionia → Piltover")
    print(f"Total Games: 205")
    print(f"\nGenerated Finale Lore:")
    print("-" * 60)
    print(lore)
    print("-" * 60)
    return lore

def test_finale_reflection():
    print("\n" + "=" * 60)
    print("TEST 4: Finale Reflection Generation")
    print("=" * 60)
    
    all_quarters = [
        {
            'stats': {
                'games': 50,
                'kda_proxy': 2.5,
                'vision_score_per_min': 1.8
            }
        },
        {
            'stats': {
                'games': 55,
                'kda_proxy': 2.8,
                'vision_score_per_min': 2.1
            }
        },
        {
            'stats': {
                'games': 48,
                'kda_proxy': 2.6,
                'vision_score_per_min': 2.3
            }
        },
        {
            'stats': {
                'games': 52,
                'kda_proxy': 3.1,
                'vision_score_per_min': 2.5
            }
        }
    ]
    
    reflections = generate_finale_reflection(all_quarters)
    
    print(f"\nSeason Progression: KDA 2.5 → 3.1, Vision 1.8 → 2.5")
    print(f"\nGenerated Reflections:")
    print("-" * 60)
    for i, reflection in enumerate(reflections, 1):
        print(f"{i}. {reflection}")
    print("-" * 60)
    return reflections

if __name__ == "__main__":
    print("🚀 Rift Rewind - Full Bedrock Integration Test\n")
    
    try:
        test_quarter_lore()
        test_quarter_reflection()
        test_finale_lore()
        test_finale_reflection()
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("\nBedrock integration is ready for deployment! 🎉")
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
