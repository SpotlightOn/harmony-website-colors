# Website color scheme generator

## Harmony site colors

Ich möchte schon lange eine app, die eine klassische Website darstellt
und hilft verschiedene FArbkombinationen auszuprobieren.

- Header link links SVG Vector Logo, rechts rinr navigation mit 4 dummy links
- Verschiedne content blocks bzw. patterns.
- Blöcke mit hell / dunkel variation bei background / text
- dazu passende link colors

damit dies möglich ist, müssen die die einzelnen Bereiche custom css properties erstellt werden die möglichst design neutral sind
- es muss guter contast ung WCAG berücksichtigt werden.

im ersten plan mach eine list mit den custom properties die due verwenden
möchstest welche bei jedem farm schema gleich bleiben muss.
Diese Konzeption ist sehr wichtig und muss genau und ausgibig recherchiert werden


Die Webseite enthält verschiedene dummy content elemente

- Eine Section mit dunklen Hintergrund und Hellen Text
- Eine Section mit 3 Teaser (css grid)
  - Bild
  - Überschrift
  - Kurztext

- Eine Section mit hellen Hintergrund und dunklen Text
  - Überschrift 2
  - Fließtext

- Weitere Sections wo unterschiedliche Farb Varianten durchspielen,
  diese müssten dyn. erzeugt werden, da anzahl der farb varianten variable.
  Es gibt jedoch immer mind. 2 varianten - hell / dunkel

## Control panel

Die Farben errechen sich aus einer grundfarbe oder random (color picker, Button für random color)
die dazu notwendigen ui elemente sind recht in einer seitebar, die so hoch ist wie die seite.
Mit einer linie ist es klar vom demo page layout links abgetrennt.
Interesannte Farb kombinationen soll man in localSorge speichern können und wieder ladden

- Auswahl eines Farb algorythmus Ideen: https://www.colorharmonygenerator.com/
- Anzahl der FArben
- Kleine Kachel Vorschau der berechnenten Farben

# Dev Vorgaben

Ich würde gerne reacht 19 benutzen und als build system rsbuild
Wenn du gerne lieber vite möchstest, kann du auch das verwenden.