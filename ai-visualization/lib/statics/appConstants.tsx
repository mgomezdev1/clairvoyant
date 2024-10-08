// These values are mostly placeholders, meant to be replaced with more refined values, and potentially specialized into multiple constants or functions

import GraphSearchPage from "@/app/problems/graph-search/page"
import React from "react"

export const APP_NAME = "Clairvoyant";
export const API_URL = process.env.NODE_ENV == "development" 
    ? "http://localhost:5000/api/v1" 
    : "/api/v1";

export interface Problem {
    id: string,
    name: string,
    href: string,
    docshref: string,
}
export const PROBLEMS : Record<string, Problem> = {
    graphsearch: {
        id: "graphsearch",
        name: "Graph Search",
        href: "/problems/graph-search",
        docshref: "/docs/graph-search"
    },
    adversarialsearch: {
        id: "adversarialsearch",
        name: "Adversarial Search",
        href: "/problems/adversarial-search",
        docshref: "/docs/adversarial-search"
    }
}