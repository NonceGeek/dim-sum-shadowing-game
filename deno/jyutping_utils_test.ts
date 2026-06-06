import { assertEquals } from "@std/assert";
import { convertToJyutping } from "./jyutping_utils.ts";

Deno.test("convertToJyutping converts characters", () => {
  const result = convertToJyutping("长老");
  assertEquals(result.text, "长老");
  assertEquals(result.jyutping, "zoeng2 lou5");
  assertEquals(result.content, "长(zoeng2)老(lou5)");
  assertEquals(result.list, [
    { character: "长", jyutping: "zoeng2" },
    { character: "老", jyutping: "lou5" },
  ]);
});

Deno.test("convertToJyutping handles sentence", () => {
  const result = convertToJyutping("我唔食辣嘢");
  assertEquals(result.jyutping, "ngo5 m4 sik6 laat6 je5");
  assertEquals(result.content, "我(ngo5)唔(m4)食(sik6)辣(laat6)嘢(je5)");
});
