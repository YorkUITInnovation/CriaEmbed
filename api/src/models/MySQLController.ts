import {Pool} from "mysql2";

export class MySQLController {
    protected pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
    }
}
