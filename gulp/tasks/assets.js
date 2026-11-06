/*
 * @title Assets
 * @description A task to copy assets.
 */

// Dependencies
import { src, dest } from "gulp";
import plumber from "gulp-plumber";
import newer from "gulp-newer";
import errorHandler from "../util/errorHandler.js";

// Config
import { paths } from "../config.js";

// Task
export function assets() {
    src("src/sitemap.txt").pipe(dest(paths.dest)); // copie à la racine
    src("src/assets/favicon/favicon.ico", { encoding: false }).pipe(dest(paths.dest)); // /favicon.ico, l'adresse par défaut
    return src(paths.assets.src, { encoding: false }).pipe(plumber({ errorHandler })).pipe(newer(paths.assets.dest)).pipe(dest(paths.assets.dest));
}

// Copie le CV à dist/cv pour qu'il soit servi à /cv/Emile_Hebert_CV.pdf
export function cv() {
    return src("src/cv/**/*", { encoding: false })
        .pipe(plumber({ errorHandler }))
        .pipe(dest(`${paths.dest}/cv`));
}
