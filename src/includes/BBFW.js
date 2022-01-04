/**
 * BBFW
 *
 * The main framework.
 */
export const BBFW = {
    app: null,
    createApplication: function (ns, application, config={}) {
        return this.app = new application(ns, config);
    }
}