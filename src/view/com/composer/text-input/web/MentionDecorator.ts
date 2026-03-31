/**
 * TipTap decorator plugin for @mentions.
 *
 * Uses a regex to detect @mentions and applies link decorations
 * (a <span> with the "autolink" class). This is stateless formatting
 * that doesn't modify TipTap's document model.
 */

import {Mark} from '@tiptap/core'
import {Node as ProsemirrorNode} from '@tiptap/pm/model'
import {Plugin, PluginKey} from '@tiptap/pm/state'
import {Decoration, DecorationSet} from '@tiptap/pm/view'

import {isValidDomain} from '#/lib/strings/url-helpers'

// Same regex used in @atproto/api for mention detection
const MENTION_REGEX = /(^|\s|\()(@)([a-zA-Z0-9.-]+)(\b)/g

function getDecorations(doc: ProsemirrorNode) {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const textContent = node.textContent

      let match
      const re = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
      while ((match = re.exec(textContent))) {
        const handle = match[3]
        // Validate that it looks like a valid handle (has valid TLD)
        if (!isValidDomain(handle) && !handle.endsWith('.test')) {
          continue
        }

        // Calculate positions - include the @ symbol
        const mentionStart = match.index + match[1].length // skip leading whitespace/paren
        const mentionEnd = mentionStart + 1 + handle.length // +1 for @

        decorations.push(
          Decoration.inline(pos + mentionStart, pos + mentionEnd, {
            class: 'autolink',
          }),
        )
      }
    }
  })

  return DecorationSet.create(doc, decorations)
}

const mentionDecoratorPlugin: Plugin = new Plugin({
  key: new PluginKey('mention-decorator'),

  state: {
    init: (_, {doc}) => getDecorations(doc),
    apply: (transaction, decorationSet) => {
      if (transaction.docChanged) {
        return getDecorations(transaction.doc)
      }
      return decorationSet.map(transaction.mapping, transaction.doc)
    },
  },

  props: {
    decorations(state) {
      return mentionDecoratorPlugin.getState(state)
    },
  },
})

export const MentionDecorator = Mark.create({
  name: 'mention-decorator',
  priority: 1000,
  keepOnSplit: false,
  inclusive() {
    return true
  },
  addProseMirrorPlugins() {
    return [mentionDecoratorPlugin]
  },
})
