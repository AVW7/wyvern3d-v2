#!/usr/bin/env python3
"""
Extract bone hierarchy from GLB file.
Outputs a structured JSON showing the rig skeleton.
"""

import json
import struct
import sys
from pathlib import Path

def extract_glb_hierarchy(glb_path: str) -> dict:
    """Extract node hierarchy from GLB binary."""
    with open(glb_path, 'rb') as f:
        # Read GLB header
        magic = struct.unpack('<I', f.read(4))[0]
        if magic != 0x46546C67:  # 'glTF' in little endian
            raise ValueError(f"Not a valid GLB file: {glb_path}")
        
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]
        
        # Read JSON chunk
        json_length = struct.unpack('<I', f.read(4))[0]
        json_type = struct.unpack('<I', f.read(4))[0]
        json_data = f.read(json_length).decode('utf-8')
        
        gltf = json.loads(json_data)
        
    return gltf

def build_tree(gltf: dict) -> list:
    """Build hierarchical tree from flat nodes list."""
    nodes = gltf.get('nodes', [])
    if not nodes:
        return []
    
    # Find root nodes (not referenced as children)
    all_children = set()
    for node in nodes:
        for child_idx in node.get('children', []):
            all_children.add(child_idx)
    
    root_indices = [i for i in range(len(nodes)) if i not in all_children]
    
    def build_subtree(idx: int, depth: int = 0) -> dict:
        node = nodes[idx]
        name = node.get('name', f'Node_{idx}')
        
        result = {
            'name': name,
            'index': idx,
            'depth': depth,
            'children': []
        }
        
        # Add transformation info if present
        if 'translation' in node:
            result['translation'] = node['translation']
        if 'rotation' in node:
            result['rotation'] = node['rotation']
        if 'scale' in node:
            result['scale'] = node['scale']
        
        # Recursively build children
        for child_idx in node.get('children', []):
            result['children'].append(build_subtree(child_idx, depth + 1))
        
        return result
    
    return [build_subtree(idx) for idx in root_indices]

def analyze_rig(glb_path: str) -> dict:
    """Full analysis of rig structure."""
    gltf = extract_glb_hierarchy(glb_path)
    nodes = gltf.get('nodes', [])
    
    # Count skins and joints
    skins = gltf.get('skins', [])
    animations = gltf.get('animations', [])
    
    # Categorize nodes
    joint_names = set()
    if skins:
        for skin in skins:
            for joint_idx in skin.get('joints', []):
                if joint_idx < len(nodes):
                    joint_names.add(nodes[joint_idx].get('name', f'Node_{joint_idx}'))
    
    # Find bones by naming patterns
    bone_categories = {
        'spine': [],
        'neck': [],
        'head': [],
        'tail': [],
        'wing': [],
        'arm': [],
        'leg': [],
        'foot': [],
        'toe': [],
        'clavicle': [],
        'finger': [],
        'dummy': [],
        'other': []
    }
    
    for i, node in enumerate(nodes):
        name = node.get('name', f'Node_{i}').lower()
        
        if 'spine' in name or 'bip002_' in name and 'spine' not in name:
            if 'spine' in name:
                bone_categories['spine'].append(nodes[i].get('name'))
        elif 'neck' in name:
            bone_categories['neck'].append(nodes[i].get('name'))
        elif 'head' in name or 'face' in name or 'jaw' in name:
            bone_categories['head'].append(nodes[i].get('name'))
        elif 'tail' in name or 'ponytail' in name:
            bone_categories['tail'].append(nodes[i].get('name'))
        elif 'wing' in name:
            bone_categories['wing'].append(nodes[i].get('name'))
        elif 'clavicle' in name:
            bone_categories['clavicle'].append(nodes[i].get('name'))
        elif 'arm' in name or 'upperarm' in name or 'forearm' in name:
            bone_categories['arm'].append(nodes[i].get('name'))
        elif 'finger' in name:
            bone_categories['finger'].append(nodes[i].get('name'))
        elif 'thigh' in name or 'calf' in name:
            bone_categories['leg'].append(nodes[i].get('name'))
        elif 'foot' in name:
            bone_categories['foot'].append(nodes[i].get('name'))
        elif 'toe' in name:
            bone_categories['toe'].append(nodes[i].get('name'))
        elif 'dummy' in name or 'bone0' in name:
            bone_categories['dummy'].append(nodes[i].get('name'))
        else:
            bone_categories['other'].append(nodes[i].get('name'))
    
    return {
        'total_nodes': len(nodes),
        'skins': len(skins),
        'animations': len(animations),
        'joint_count': len(joint_names),
        'categories': bone_categories,
        'tree': build_tree(gltf)
    }

def print_tree(nodes: list, indent: int = 0):
    """Pretty print tree structure."""
    for node in nodes:
        prefix = '  ' * indent
        children_count = len(node.get('children', []))
        print(f"{prefix}├─ {node['name']} [{node['index']}]")
        print_tree(node.get('children', []), indent + 1)

def main():
    glb_path = sys.argv[1] if len(sys.argv) > 1 else '/Users/ajadvanwyk/wyvern3d/public/models/drogon.glb'
    
    print(f"Analyzing: {glb_path}")
    print("=" * 60)
    
    analysis = analyze_rig(glb_path)
    
    print(f"\n📊 STATISTICS")
    print(f"   Total nodes: {analysis['total_nodes']}")
    print(f"   Skins: {analysis['skins']}")
    print(f"   Animations: {analysis['animations']}")
    print(f"   Skinned joints: {analysis['joint_count']}")
    
    print(f"\n📁 BONE CATEGORIES")
    for category, bones in analysis['categories'].items():
        if bones:
            print(f"   {category}: {len(bones)} bones")
            for bone in bones[:5]:  # Show first 5
                print(f"      - {bone}")
            if len(bones) > 5:
                print(f"      ... and {len(bones) - 5} more")
    
    print(f"\n🌲 HIERARCHY TREE (first 3 levels)")
    # Print only first few levels to avoid flooding
    def print_limited(nodes: list, indent: int = 0, max_depth: int = 3):
        if indent >= max_depth:
            return
        for node in nodes:
            prefix = '  ' * indent
            children_count = len(node.get('children', []))
            print(f"{prefix}├─ {node['name']}")
            print_limited(node.get('children', []), indent + 1, max_depth)
    
    print_limited(analysis['tree'])
    
    # Save full analysis to JSON
    output_path = Path(glb_path).with_suffix('.rig-analysis.json')
    with open(output_path, 'w') as f:
        json.dump(analysis, f, indent=2)
    print(f"\n✅ Full analysis saved to: {output_path}")

if __name__ == '__main__':
    main()
