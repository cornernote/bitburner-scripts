/**
 * Deletes a task file, probably because the task is complete.
 *
 * Doing this here allows us to save the RAM from our task script.
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * - 1.0GB ns.rm()
 * - 0.1GB ns.fileExists()
 * @param {NS} ns
 */
export async function main(ns) {
    let uuid = ns.args[0];
    if (!uuid) {
        throw 'missing UUID';
    }
    let filename = `/runners/${uuid}.js`;
    if (!ns.fileExists(filename)) {  //@RAM 0.1GB
        throw `cannot find task file for cleanup "${filename}", already cleaned?`;
    }
    ns.rm(filename); //@RAM 1GB
}
