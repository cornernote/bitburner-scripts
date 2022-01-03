import {BaseComponent} from "/includes/BaseComponent";

/**
 * ProcessManager
 */
export class ProcessManager extends BaseComponent {
    verbose = false;

    /**
     * Wait for a process id to complete running
     * @RAM 0.1 GB for ns.isRunning
     * @param {int} pid - The process id to monitor
     **/
    async waitForProcessToComplete(pid) {
        return await this.waitForProcessToComplete_Custom(this.app.ns.isRunning, pid);
    }

    /**
     * An advanced version of waitForProcessToComplete that lets you pass your own "isAlive" test to reduce RAM requirements (e.g. to avoid referencing ns.isRunning)
     * Importing incurs 0 GB RAM (assuming fnIsAlive is implemented using another ns function you already reference elsewhere like ns.ps)
     * @param {int} pid - The process id to monitor
     * @param {function} fnIsAlive - A single-argument function used to start the new script, e.g. `ns.isRunning` or `pid => ns.ps("home").some(process => process.pid === pid)`
     **/
    async waitForProcessToComplete_Custom(fnIsAlive, pid) {
        // Wait for the PID to stop running (cheaper than e.g. deleting (rm) a possibly pre-existing file and waiting for it to be recreated)
        for (let retries = 0; retries < 1000; retries++) {
            if (!fnIsAlive(pid))
                break; // Script is done running
            if (this.verbose && retries % 100 === 0)
                this.app.logger.log(`Waiting for pid ${pid} to complete... (${retries})`);
            await this.app.ns.sleep(10);
        }
        // Make sure that the process has shut down, and we haven't just stopped retrying
        if (fnIsAlive(pid)) {
            let errorMessage = `run-command pid ${pid} is running much longer than expected. Max retries exceeded.`;
            this.app.logger.log(errorMessage);
            throw errorMessage;
        }
    }

}
