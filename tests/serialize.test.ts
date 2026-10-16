import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { removeEntries, sequenceOf } from "../src/plan/edit";
import { parseConstructionPlans } from "../src/plan/parse";
import { serializePlans } from "../src/plan/serialize";

const sample = readFileSync(resolve(__dirname, "../src/samples/ARG_EnCells_2C.xml"), "utf8");
const [plan] = parseConstructionPlans(sample);

/** Drops the per-plan source so plans read from different XML compare by content. */
const content = (plans: ReturnType<typeof parseConstructionPlans>) => plans.map(({ source: _, ...rest }) => rest);

describe("serializePlans", () => {
  it("reproduces an unedited plan file", () => {
    expect(serializePlans([plan]).trim()).toBe(sample.trim());
  });

  it("round-trips an edited plan", () => {
    const edited = removeEntries(plan, sequenceOf(plan, "28"));
    const xml = serializePlans([edited]);
    expect(content(parseConstructionPlans(xml))).toEqual(content([edited]));
    expect(xml).not.toMatch(/\n\s*\n/);
  });

  it("keeps attributes and children the viewer does not model", () => {
    const [custom] = parseConstructionPlans(`<plans>
  <plan id="a" name="A" custom="1">
    <entry index="1" macro="hab_arg_s_01_macro">
      <upgrades><groups><turrets macro="turret_arg_m_laser_01_mk1_macro" exact="2"/></groups></upgrades>
    </entry>
    <entry index="2" macro="struct_arg_cross_01_macro" connection="connectionsnap001">
      <predecessor index="1" connection="connectionsnap002"/>
    </entry>
    <entry index="3" macro="struct_arg_cross_01_macro">
      <predecessor index="2"/>
    </entry>
  </plan>
</plans>`);
    const xml = serializePlans([removeEntries(custom, sequenceOf(custom, "2"))]);
    expect(xml).toContain('custom="1"');
    expect(xml).toContain('<turrets macro="turret_arg_m_laser_01_mk1_macro" exact="2"/>');
    expect(xml).not.toContain('index="2"');
    expect(xml).not.toContain("<predecessor");
  });

  it("writes several plans into one file", () => {
    const plans = parseConstructionPlans(`<plans><plan id="a" name="A"><entry index="1" macro="x"/></plan><plan id="b"><entry index="1" macro="y"/></plan></plans>`);
    expect(parseConstructionPlans(serializePlans(plans)).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
