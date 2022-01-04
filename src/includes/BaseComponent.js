/**
 * BaseComponent
 *
 * Base component class used to extend to other classes.
 */
export class BaseComponent {

    /**
     * @type {Application}
     */
    app = null;

    /**
     * Construct the component
     *
     * @param {Application} app - The application instance created in your script's main entry point
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(app, config = {}) {
        if (!app.ns.print) throw 'The first argument to BaseComponent.constructor() must be an application with property "ns" being an instance of "ns".';
        this.app = app;

        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value);
    }

}