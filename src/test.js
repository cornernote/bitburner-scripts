import {BBFW} from "./includes/BBFW"
import {Application} from "./includes/Application";
import {TaskManager} from "./components/TaskManager";

/**
 * Spider Nuke
 *
 * Spiders and nukes all available servers for Root Access.
 *
 * @RAM 2.7GB/thread = 1.1GB (+1.6GB for base script)
 * @param {NS} ns
 */
export async function main(ns) {

    //BBFW.createApplication(ns, Application);
    BBFW.createApplication(ns, Application, {
        components: {
            taskManager: {
                className: TaskManager,
                verbose: true,
            },
        },
    });

    BBFW.app.logger.log('TESTING 123', true);

}

