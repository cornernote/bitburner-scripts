import {Application} from "/includes/Application";

/**
 * Hello World!

 * @param {NS} ns
 */
export async function main(ns) {
    let app = new Application(ns);
    app.logger.log('Hello World!', true);
}
