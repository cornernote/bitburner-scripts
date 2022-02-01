import {convertCSVtoArray, listView} from "./lib/Helpers";

/**
 * @param {NS} ns
 */
export async function main(ns) {


    const statsContents = ns.read('/data/port-stats.csv.txt')
    const stats = convertCSVtoArray(statsContents).filter(s => s.type !== 'check')

    ns.tprint('Stats:\n' + listView(stats.map(s => {
        return s
    })))

}
