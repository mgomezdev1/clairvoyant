"use client"

import Header from "@/app/components/header";
import GraphView from "./components/graphView";
import SolutionEditor from "@/app/components/data/solutionEditor";
import CaseEditor from "@/app/components/data/problemEditor";
import { Graph, GridGraph } from "@/lib/graphs/graph";
import { GraphSearchResult, GraphSearchSolution, buildGraphSearchSolution } from "@/lib/graphs/graphsolution"; // Import the missing class
import { useCallback, useState } from "react";
import { ensureError } from "@/lib/errors/error";
import { HDivider, VDivider } from "@/app/components/divider";
import { toast } from "react-toastify";

const init_graph : Graph | null = null;

export default function GraphSearchPage() {
    let [graph, setGraph] = useState(init_graph);
    let [graphData, setGraphData] = useState("");
    let [leftWidth, setLeftWidth] = useState(480);
    let [solHeight, setSolHeight] = useState(520);
    let [graphErrorMessage, setGraphErrorMessage] = useState("");
    let [algoErrorMessage, setAlgoErrorMessage] = useState("");
    let [debugData, setDebugData] = useState(null as any);
    let [solutionData, setSolutionData] = useState("");
    let [graphSteps, setGraphSteps] = useState([] as GraphSearchResult[]);
    let [graphStepIndex, setGraphStepIndex] = useState(0);
    
    function updateSolutionSteps(solverData: string, graph: Graph | null) {
        if (!solverData || !graph) {
            return {success: false, fault: "graph", message: "Invalid solver or graph"};
        }

        if (!graph.startNode || !graph.endNode) {
            return {success: false, fault: "graph", message: "Invalid start or end node"};
        }

        try {
            let sol = buildGraphSearchSolution(solverData, graph);
            let steps = sol.getSolutionSteps(graph.startNode, graph.endNode);
            setGraphSteps(steps);
            setGraphStepIndex(0);
            return {success: true, message: "Solution steps updated"};
        } catch (err) {
            let error = ensureError(err);
            return {success: false, fault: "solver", message: error.message};
        }
    };
    function runAlgo() {
        let result = updateSolutionSteps(solutionData, graph);
        if (result.success) {
            toast.success(result.message);
            setGraphErrorMessage("");
            setAlgoErrorMessage("");
            return;
        };
    
        if (result.fault == "graph") {
            setGraphErrorMessage(result.message);
        } else if (result.fault == "solver") {
            setAlgoErrorMessage(result.message);
        } else {
            toast.error(result.message);
        }
    }

    const onGraphDataChanged = useCallback((rawData: string) => {
        setGraphData(rawData);
        try {
            setGraph(Graph.parseGraph(rawData));
            setGraphErrorMessage("");
        }
        catch (err) {
            let error = ensureError(err);
            setGraphErrorMessage(error.message);
            return;
        }
    },[]);
    const onSolutionDataChanged = useCallback((rawData: string) => {
        setSolutionData(rawData);
        setAlgoErrorMessage("");
    },[]);
    
    // Execute the step at StepIndex
    const handleStep = useCallback((steps: GraphSearchResult[], stepIndex: number) => {
        if (!graph) {
            throw new Error("Graph cannot be null at step handling.");
        }
        if (stepIndex >= steps.length) {
            return steps.length;
        }
        let step = steps[stepIndex];
        if (step.actType === "visit") {
            graph.visitNode(step.cell!);
        }
        else if (step.actType === "expand") {
            graph.expandNode(step.cell!);
        }
        setDebugData(step.debugValue);
        setGraphStepIndex(stepIndex + 1);
        return stepIndex + 1;
    },[graph]);
    // Undo the step at StepIndex - 1
    const handleBackStep = useCallback((steps: GraphSearchResult[], stepIndex: number) => { 
        if (!graph) {
            throw new Error("Graph cannot be null at step handling.");
        }
        if (stepIndex <= 0) {
            return 0;
        }
        let step = steps[stepIndex - 1];
        if (step.actType === "visit") {
            graph.unvisitNode(step.cell!);
        }
        else if (step.actType === "expand") {
            graph.unexpandNode(step.cell!);
        }
        setDebugData(stepIndex >= 2 ? steps[stepIndex - 2].debugValue : null);
        setGraphStepIndex(stepIndex - 1);
        return stepIndex - 1;
    },[graph]);
    
    const onResetRequested = useCallback(() => {
        setGraphStepIndex(0);
        try {
            let graph = Graph.parseGraph(graphData);
            setGraph(graph);
            setGraphErrorMessage("");
        }
        catch (err) {
            let error = ensureError(err);
            setGraphErrorMessage(error.message);
            toast.error(`There was an error while reloading the graph: ${error.message}`)
        }
    },[graphData]);
    const onStepRequested = useCallback((delta: number) => {
        if (!graph || !graph.startNode || !graph.endNode) {
            toast.error("Invalid graph. Please make sure the graph is valid.");
            return;
        }
        let steps = graphSteps;
        if (!graphSteps) {
            toast.error("No steps to step through. Please run the solver first.");           
        }

        let stepIndex = graphStepIndex;
        if (delta < 0) {
            if (stepIndex <= 0) {
                toast.error("No more steps to undo!");
                return;
            }
            delta = -delta;
            for (let i = 0; i < delta; i++) {
                stepIndex = handleBackStep(steps, stepIndex);
            }
        } else {
            if (stepIndex >= graphSteps.length) {
                toast.error("Last step reached!");
                return;
            }
            for (let i = 0; i < delta; i++) {
                stepIndex = handleStep(steps, stepIndex);
            }
        }
    },[graph, graphStepIndex, graphSteps, handleBackStep, handleStep]);
    const onSolveRequested = useCallback(() => {
        if (!graph || !graph.startNode || !graph.endNode) {
            toast.error("Invalid graph. Please make sure the graph is valid.");
            return;
        }
        let steps = graphSteps;
        if (!graphSteps) {
            toast.error("No steps to step through. Please run the solver first.");
        }
        let stepIndex = graphStepIndex;
        while (stepIndex < steps.length) {
            handleStep(steps, stepIndex);
        }
        setGraphStepIndex(stepIndex);
    },[graph, graphStepIndex, graphSteps, handleStep]);
    
    // command execution
    let executed = graph?.commandHandler.executeToCurrent(graph);
    if (executed && executed.length > 0) {
        for (let cmd of executed) console.log(`Executed command: ${cmd.name}`);
        // Backwards update from commands!
        setGraphData(graph!.stringify());
    }

    return (
        <div className="flex flex-col h-dvh">
            <Header selectedPage="graphsearch"></Header>
            <div className="flex flex-row items-stretch flex-grow">
                <div className="flex flex-col justify-stretch" style={{"width": `${leftWidth}px`}}>
                    <SolutionEditor solutionHeight={solHeight} problem={"graph-search"} solutionChanged={onSolutionDataChanged} runner={runAlgo} errorMessage={algoErrorMessage}></SolutionEditor>
                    <HDivider onWidthChangeRequest={function (v: number): void {
                        setSolHeight(solHeight + v);
                    } }></HDivider>
                    <CaseEditor problem={"graph-search"} caseData={graphData} onCaseDataChanged={onGraphDataChanged} errorMessage={graphErrorMessage}></CaseEditor>
                </div>
                <VDivider onWidthChangeRequest={(v => {
                    setLeftWidth(leftWidth + v);
                })}></VDivider>
                <div className="p-3 m-2 rounded-md border-accent dark:border-accent-200 border-solid border flex-grow">
                    <GraphView graph={graph} resetHandler={onResetRequested} stepHandler={onStepRequested} solveHandler={onSolveRequested}
                    stepIndex={graphStepIndex} totalSteps={graphSteps.length} logData={debugData}></GraphView>
                </div>
            </div>
        </div>
    )
}