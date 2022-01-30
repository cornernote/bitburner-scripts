import {scanAll} from "./lib/Server";

/**
 * Removes all scripts on the network
 *
 * @param {NS} ns
 */
export async function main(ns) {
    for (const server of scanAll(ns)) {
        for (const file of ns.ls(server)) {
            ns.rm(file, server)
        }
    }
}
