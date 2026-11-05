/*
 * @title Watch
 * @description A task to start the server and watch for changes.
 */

// Dependencies
import gulp from "gulp";
import { series } from "gulp";

// Tasks
import { reload, serve } from "./server.js";
import { styles } from "./styles.js";
import { scripts } from "./scripts.js";
import { templates } from "./templates.js";
import { assets, cv } from "./assets.js";

// Config
import { paths } from "../config.js";

function watchFiles() {
    gulp.watch([paths.styles.watch], styles);
    gulp.watch([paths.scripts.watch], series(scripts, reload));
    gulp.watch([paths.templates.watch], series(templates, reload));
    gulp.watch(paths.assets.src, series(assets, reload));
    gulp.watch("src/cv/**/*", series(cv, reload));
}

export const watch = series(serve, watchFiles);
