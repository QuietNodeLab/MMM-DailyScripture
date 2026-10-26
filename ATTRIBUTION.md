# Attribution and data sources

MMM-DailyScripture contains custom module code extracted into a standalone
package. MagicMirror² (https://github.com/MagicMirrorOrg/MagicMirror) is a
separate MIT-licensed runtime dependency, not bundled source. The package MIT
license covers its code; it does not grant rights to third-party content
supplied by users or external APIs. Examples are synthetic. Screenshots use the
system's font/emoji renderer; no font or emoji image collection is bundled.
Inline drawings are retained from the custom source. No upstream module patch or
production image collection is included.

Default provider: https://bible-api.com/ , using the World English Bible (WEB).
WEB is distributed as public-domain text; see https://worldenglish.bible/ . The
built-in offline verse is identified as WEB, and provider/version are shown on
the card. No remote verse collection is bundled. Respect the provider's access
limits.

Optional provider: https://beta.ourmanna.com/ . Its response can select
translations with different rights; their display/redistribution terms are not
covered by MIT. Verify current provider and translation terms before enabling
that optional source or redistributing its output. The default WEB path avoids
depending on that source. Screenshots and tests use invented text, not copied
provider responses. Live terms and endpoints were not independently verified
during this extraction.
