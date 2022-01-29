import {getServers} from "./lib/Server";
import {detailView, gridView} from "./lib/Helpers";

/**
 * @param {NS} ns
 */
export async function main(ns) {
    const servers = getServers(ns)
    ns.tprint(gridView(servers.map(s => {
        return {
            hostname: `<a href="foo.js">${s.hostname}</a>`,
            serverGrowth: s.serverGrowth,
        }
    })))
    // ns.tprint(detailView(servers[0]))
}
