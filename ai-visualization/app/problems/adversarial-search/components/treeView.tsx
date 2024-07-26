import { dijsktra } from "@/lib/graphs/algorithms"
import { Graph, GraphEdge, GraphNode } from "@/lib/graphs/graph"
import { colorLerp, colorWithAlpha } from "@/lib/utils/colors";
import { useCallback, useEffect, useState } from "react"
import VisGraph, { GraphData, Options as VisGraphOptions } from "react-vis-graph-wrapper"
import { Font, NodeOptions } from "vis-network";
import { GraphEvents } from "@/lib/graphs/vis-events";
import { AdversarialSearchPosition } from "@/lib/adversarial/adversarialCase";
import { AdversarialSearchAction } from "@/lib/adversarial/adversarialSolution";
import { buttonStyleClassNames } from "@/lib/statics/styleConstants";
import { showConfirmation } from "@/app/components/dialogs/comfirm";

import "./treeView.css";

function getVisOptions(graph: Graph | null = null): VisGraphOptions {
    let fontColor = "#7777ff";
    let fontStrokeColor = "#000000";
    let fontData : Font = {
        size: 14,
        color: fontColor,
        strokeWidth: 1,
        strokeColor: fontStrokeColor,
    };

    let base: VisGraphOptions = {
        edges: {
            labelHighlightBold: true,
            font: fontData,
            color: "white"
        },
        nodes: {
            font: fontData,
            scaling: {
                label: true
            }
        },
        height: "100%",
        interaction: {
            hover: true
        },
        layout: { 
            hierarchical: {
                enabled: true,
                levelSeparation: 120,
                nodeSpacing: 30,
                treeSpacing: 200,
                blockShifting: true,
                edgeMinimization: true,
                parentCentralization: true,
                direction: "UD",
                sortMethod: "directed"
            }
        },
    }
    return base;
};

function getNodeAttributes(node: GraphNode, globals: VisGraphOptions): NodeOptions {
    let result : NodeOptions = {};
    let c = "#888888";
    let bc = "#444444";
    let pos : AdversarialSearchPosition = node.data["position"];
    if (pos.isTerminal()) {
        c = colorLerp("#ff0000", "#00ff00", (pos.getScore() / 2 + 0.5));
    }
    let utility = pos.getUtility();
    if (utility !== undefined) {
        bc = colorLerp("#ff0000", "#00ff00", (utility / 2 + 0.5));
    }

    let shape = "ellipse";
    let player = pos.getPlayer();
    let terminal = pos.isTerminal();
    if (!terminal) {
        if (player === 1) {
            shape = "triangle";
        } else if (player === -1) {
            shape = "triangleDown";
        }
    }
    result.shape = shape;
    result.size = 12;

    //bc = node.data["highlighted"] ? "#ff0000" : bc;
    result.borderWidth = node.data["highlighted"] ? 3 : 1;
    result.color = {border: bc, background: c, highlight: {border: bc}};
    result.font = {
        "color": (globals.nodes!.font! as Font).color!,
        "strokeColor": (globals.nodes!.font! as Font).strokeColor!,
    };

    if (pos.style) {
        for (let key in Object.keys(pos.style)) {
            // We have to do this because typescript doesn't know that the key is a valid key of NodeOptions
            (result as any)[key] = (pos.style as any)[key];
        }
    }

    return result;
}

function getEdgeAttributes(edge: GraphEdge): Record<string, any> {
    let result : Record<string, any> = {};
    let c = "#ffffff";
    if (edge.getProp("highlighted")) {
        c = "#ff0000";
    }
    let action : AdversarialSearchAction = edge.data["action"];
    let sourcePos: AdversarialSearchPosition = edge.source.data["position"];
    let isBest = false;
    if (action && sourcePos) {
        let actName = action["name"]
        let sourcePosBestActions = sourcePos.bestMoves
        if (actName && (sourcePosBestActions?.length ?? 0) > 0) {
            isBest = (sourcePosBestActions?.findIndex(a => a.action.name === actName) ?? -1) >= 0;
        }
    }
    if (isBest) {
        c = "#3333ff";
    }
    result.color = c;
    result.label = edge.data["action"]["label"] ?? edge.data["action"]["name"] ?? "";
    return result;
}

function countChildren(node: GraphNode, visited: Set<string> = new Set()): number {
    let count = 0;
    for (let child of node.graph.getAdjacentNodes(node)) {
        if (!visited.has(child.id)) {
            visited.add(child.id);
            count += 1 + countChildren(child, visited);
        }
    }
    return count;
}

export default function TreeView({graph, onNodeSelected = (x) => {}, renderKey}: {
    graph: Graph | null,
    onNodeSelected?: (node: GraphNode | null) => void,
    renderKey: number
}) {
    let [graphData, setGraphData] = useState<GraphData>({nodes: [], edges: []})
    let [graphOptions, setGraphOptions] = useState<VisGraphOptions>(getVisOptions(graph));
    let [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    let requestExpandAll = useCallback(async () => {
        if (!graph) return;
        let allNodes = graph?.getAllNodes();
        let confirmation = await showConfirmation(`Are you sure you want to expand all ${allNodes.length} nodes? Expanding too many nodes could have adverse performance effects or even crash the application. This action cannot be undone.`);
        if (confirmation) {
            setExpandedNodes(new Set(allNodes.map(n => n.id)));
        }
    }, [graph, renderKey])
    let requestCollapseAll = useCallback(async () => {
        let confirmation = await showConfirmation(`Are you sure you want to collapse all ${expandedNodes.size} expanded nodes? This action cannot be undone.`);
        if (confirmation) {
            setExpandedNodes(new Set());
        }
    }, [expandedNodes])

    useEffect(() => {
        if (!graph || !graph.startNode) { return; }

        let visGraphOptions = getVisOptions(graph);
        let data: GraphData = {nodes:[], edges:[]};

        let startPos = graph.startNode;
        let q = [{node: startPos, distance: 0}];
        let visited = new Set<string>();
        while (q.length > 0) {
            let {node, distance} = q.shift()!;
            if (visited.has(node.id)) continue;
            visited.add(node.id);
            let label = ""; node.getProp("label");
            let pos : AdversarialSearchPosition = node.data["position"];
            if (expandedNodes.has(node.id)) {
                q.push(...[...graph.getAdjacentNodes(node)].map(n => ({node: n, distance: distance + 1})));
            } else if (!pos.isTerminal()) {
                let children = node.data["childCount"] ?? countChildren(node);
                label = `${label} (${children})`.trimStart();
            }
            data.nodes.push({id: node.id, label: label, level: distance, ...getNodeAttributes(node, visGraphOptions)});
            for (let edge of graph.getIncomingEdges(node)) {
                data.edges.push({id: edge.id, from: edge.source.id, to: edge.target.id, arrows: 'to', ...getEdgeAttributes(edge)});
            }
        }
        console.log(data);
        setGraphData(data);
        console.log(visGraphOptions);
        setGraphOptions(visGraphOptions);
    }, [expandedNodes, graph, renderKey])

    let events: GraphEvents = {
        click: (event) => {
            
        },
        doubleClick: (event) => {
            if (event.nodes.length <= 0) return;
            let nodeId = event.nodes[0] as string;
            let node = graph?.getNodeById(nodeId);
            if (!node) return;
            let pos : AdversarialSearchPosition = node.data["position"];
            if (pos.isTerminal()) return;
            if (expandedNodes.has(nodeId)) {
                expandedNodes.delete(nodeId);
            } else {
                expandedNodes.add(nodeId);
            }
            setExpandedNodes(new Set(expandedNodes));
        },
        selectNode: (event) => {
            if (event.nodes.length <= 0) return;
            let nodeId = event.nodes[0] as string;
            let node = graph?.getNodeById(nodeId);
            if (!node) return;
            onNodeSelected(node);            
        },
        deselectNode: (event) => {
            onNodeSelected(null);
        }
    }
    
    return (
        <div className="relative w-full h-full">
            <VisGraph 
                graph={graphData} 
                options={graphOptions}
                events={events}
            />
            <div className={`tree-view-overlay flex flex-col items-end gap-2 ${graphData.nodes.length > 0 ? '' : 'hidden'}`}>
                <button className={`${buttonStyleClassNames} p-1 rounded-xl`} onClick={requestExpandAll}>Expand All</button>
                <button className={`${buttonStyleClassNames} p-1 rounded-xl`} onClick={requestCollapseAll}>Collapse All</button>
            </div>
        </div>
    )
    return 
}