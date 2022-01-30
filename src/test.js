import {getRoutes, getServers} from "./lib/Server";
import {detailView, listView} from "./lib/Helpers";

/**
 * @param {NS} ns
 */
export async function main(ns) {
    const servers = getRoutes(ns)
    ns.tprint(servers)
}
