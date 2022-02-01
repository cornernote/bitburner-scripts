import {convertCSVtoArray, listView} from "./lib/Helpers";

/**
 * @param {NS} ns
 */
export async function main(ns) {

    const stats = convertCSVtoArray(ns.read('/data/port-stats.csv.txt'))
        .filter(s => s.type !== 'check')
        .sort((a, b) => a.start + a.delay + a.time - b.start + b.delay + b.time)

    ns.tprint('Stats:\n' + listView(stats.map(s => {
        return s
    })))

}
