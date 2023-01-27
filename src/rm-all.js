import {scanAll} from './lib/Server';

/**
 * Removes all scripts on the network
 *
 * @param {NS} ns
 */
export async function main(ns) {
    for (const server of scanAll(ns.scan)) {
        for (const file of ns.ls(server)) {
            if (file.endsWith('.js') || file.endsWith('.json')) {
                ns.tprint('removed ' + file + ' from ' + server)
                ns.rm(file, server)
            }
        }
    }
}
