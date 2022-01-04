/**
 * Installs a backdoor on the current host.
 *
 * @RAM 3.6GB/thread = 2.0GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {
    let target = ns.args.length > 0 ? ns.args[0] : '(unspecified server)';
    try {
        await ns.installBackdoor(); //@RAM 2.0GB
        ns.toast(`Backdoored ${target}`, 'success');
    } catch (err) {
        ns.tprint(`Error while running backdoor (intended for ${target}): ${String(err)}`);
        throw (err);
    }
}