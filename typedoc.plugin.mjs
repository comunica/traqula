// @ts-check
/**
 * Markdown in this repository links to other files using plain relative paths, so that the links
 * work when the files are read on the repository host (GitHub) itself.
 *
 * TypeDoc resolves such a link whenever it generated a page for the target (a package directory,
 * a package README, or a document listed in `projectDocuments`). For everything else - source
 * files, directories that are not a package - it falls back to copying the target into `media/`,
 * which produces a raw file dump for source code and a dead link for directories.
 *
 * This plugin rewrites exactly those unresolved links to absolute URLs, built from the
 * `repositoryLinkTemplate` option, so the repository host is configured in one place instead of
 * being hardcoded in every Markdown file.
 */
import { existsSync, statSync } from 'node:fs';
import { extname, relative, sep } from 'node:path';
import { ParameterType, RendererEvent } from 'typedoc';

/** Assets TypeDoc can serve from the generated site itself; these keep their `media/` link. */
const COPIED_ASSETS = new Set([ '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico' ]);

/** `#L18` / `#L18-L39`: a line reference that only the repository host understands. */
const LINE_ANCHOR = /^L\d+(?:-L?\d+)?$/u;

export function load(app) {
  app.options.addDeclaration({
    name: 'repositoryLinkTemplate',
    help: 'URL template used for relative links TypeDoc has no page for. ' +
      '`{kind}` becomes `blob` for files and `tree` for directories, `{path}` the repository relative path.',
    type: ParameterType.String,
    defaultValue: '',
  });

  app.renderer.on(RendererEvent.BEGIN, (event) => {
    const template = app.options.getValue('repositoryLinkTemplate');
    if (!template) {
      return;
    }
    const { project } = event;
    const root = process.cwd();
    let rewritten = 0;

    for (const parts of contentParts(project)) {
      for (const part of parts) {
        if (part.kind !== 'relative-link' || typeof part.target !== 'number') {
          continue;
        }
        const path = project.files.resolvePath(part.target);
        if (path === undefined || COPIED_ASSETS.has(extname(path).toLowerCase())) {
          continue;
        }
        // Line references never survive as an anchor on a generated page, so they always go to the host.
        const lineReference = part.targetAnchor !== undefined && LINE_ANCHOR.test(part.targetAnchor);
        if (!lineReference && typeof project.files.resolve(part.target, project) === 'object') {
          continue;
        }
        const path_ = relative(root, path).split(sep).join('/');
        if (path_.startsWith('..')) {
          continue;
        }
        const kind = existsSync(path) && statSync(path).isDirectory() ? 'tree' : 'blob';
        part.text = template.replace('{kind}', kind).replace('{path}', path_) +
          (part.targetAnchor === undefined ? '' : `#${part.targetAnchor}`);
        part.target = undefined;
        part.targetAnchor = undefined;
        rewritten += 1;
      }
    }
    app.logger.info(`Rewrote ${rewritten} relative link(s) to the repository host`);
  });
}

/**
 * All Markdown content TypeDoc renders: the project README, the README of every package,
 * the documents from `projectDocuments`, and every doc comment.
 */
function* contentParts(project) {
  if (project.readme) {
    yield project.readme;
  }
  for (const reflection of Object.values(project.reflections)) {
    if (reflection.readme) {
      yield reflection.readme;
    }
    if (reflection.isDocument()) {
      yield reflection.content;
    }
    if (reflection.comment) {
      yield reflection.comment.summary;
      for (const tag of reflection.comment.blockTags) {
        yield tag.content;
      }
    }
  }
}
