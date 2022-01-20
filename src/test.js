/**
 * @param {NS} ns
 */
export async function main(ns) {


    ns.tprint(ns['getServer']('home').hostname)

}

export function foo(ns) {
    ns.getServer('home')
}