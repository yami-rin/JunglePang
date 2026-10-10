import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Original, small-format mascot drawings based on the local character portraits.
// All details stay inside the same 200 x 132 frame used by the animal art.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public/art');
const emaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 132">
<ellipse cx="100" cy="125" rx="64" ry="5" fill="#143d30" opacity=".13"/>
<!-- The head and the hair form one broad, stackable silhouette. -->
<path d="M33 63Q27 57 39 50Q42 29 70 23Q95 10 127 21Q151 23 163 44Q171 51 166 62Q177 70 165 77Q169 95 151 109Q139 123 101 123Q60 125 45 109Q27 94 35 76Q24 69 33 63Z" fill="#eee9ed" stroke="#30272d" stroke-width="4" stroke-linejoin="round"/>
<path d="M40 77Q43 48 78 41Q112 30 145 48Q159 60 158 85Q154 119 100 120Q46 117 40 77Z" fill="#fff1eb"/>
<path d="M34 76Q31 95 45 108Q51 110 53 96L62 100Q66 116 79 121Q62 121 47 112Q30 105 34 76Z" fill="#ee84a3"/>
<path d="M166 74Q172 93 154 111Q142 122 125 120Q139 111 141 98L151 95Q153 108 159 103Q166 91 166 74Z" fill="#ee84a3"/>
<path d="M33 64Q49 52 45 42Q58 23 89 21Q116 16 142 34Q158 43 167 61Q156 62 151 54L148 77Q140 70 135 57L128 69L121 62L116 82L105 72L99 83L87 72L80 82L72 69L61 81L55 68Q48 78 34 76Q27 72 33 64Z" fill="#f1edef" stroke="#30272d" stroke-width="3.5" stroke-linejoin="round"/>
<path d="M58 39Q50 53 51 61M78 29Q71 44 72 54M107 25Q111 44 104 54M130 37Q137 45 138 54" fill="none" stroke="#d7cad5" stroke-width="3" stroke-linecap="round"/>
<path d="M48 94Q40 105 50 112M151 96Q159 108 149 113" fill="none" stroke="#30272d" stroke-width="3" stroke-linecap="round"/>
<path d="M59 83Q69 71 81 82M117 82Q130 71 141 84" fill="none" stroke="#553d4a" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="72" cy="88" rx="9" ry="11" fill="#bd4d68"/><ellipse cx="128" cy="88" rx="9" ry="11" fill="#bd4d68"/>
<ellipse cx="72" cy="88" rx="6" ry="9" fill="#e87898"/><ellipse cx="128" cy="88" rx="6" ry="9" fill="#e87898"/>
<circle cx="75" cy="83" r="3" fill="#fff8f4"/><circle cx="131" cy="83" r="3" fill="#fff8f4"/>
<ellipse cx="51" cy="101" rx="10" ry="5" fill="#f2a9ad" opacity=".8"/><ellipse cx="149" cy="101" rx="10" ry="5" fill="#f2a9ad" opacity=".8"/>
<path d="M93 107Q100 113 107 107" fill="none" stroke="#ab5264" stroke-width="3" stroke-linecap="round"/>
<!-- Flat tilted beret, two flowers, and the large cross pin. -->
<path d="M71 29Q67 13 82 7Q103 -2 133 9Q153 15 158 28Q166 38 158 54Q153 44 143 41Q136 31 112 28Q90 30 71 29Z" fill="#34383c" stroke="#30272d" stroke-width="4" stroke-linejoin="round"/>
<path d="M86 11Q118 4 143 21" fill="none" stroke="#515155" stroke-width="4" stroke-linecap="round"/>
<g stroke="#30272d" stroke-width="2.5" stroke-linejoin="round">
<path d="M139 24Q128 19 132 11Q139 7 145 17Q151 8 158 13Q164 19 156 25Q167 28 165 35Q161 41 151 34Q149 43 142 42Q135 39 139 32Q128 34 126 28Q126 23 139 24Z" fill="#fff6f4"/>
<circle cx="146" cy="26" r="5" fill="#f1a4bc"/>
<path d="M160 34Q156 30 159 27Q164 25 166 31Q171 28 174 32Q176 36 170 39Q173 43 169 46Q165 48 162 42Q158 45 155 42Q154 38 160 34Z" fill="#fff6f4"/>
<circle cx="165" cy="36" r="3" fill="#f1a4bc"/>
</g>
<path d="M143 51L156 66M156 51L143 66" fill="none" stroke="#30272d" stroke-width="5" stroke-linecap="round"/>
</svg>\n`;
const flower = (x, y, petal, center = '#f0b265') => `<g transform="translate(${x} ${y})" stroke="#57475a" stroke-width="2"><circle cx="-6" cy="0" r="5" fill="${petal}"/><circle cx="6" cy="0" r="5" fill="${petal}"/><circle cx="0" cy="-6" r="5" fill="${petal}"/><circle cx="0" cy="6" r="5" fill="${petal}"/><circle r="4" fill="${center}"/></g>`;
const bow = (x, y, color) => `<g transform="translate(${x} ${y})" stroke="#51404d" stroke-width="2.5" stroke-linejoin="round"><path d="M0 0Q-17-14-18 0Q-18 12 0 2Q18 12 18 0Q17-14 0 0Z" fill="${color}"/><circle r="4" fill="#fff0dc"/></g>`;
const star = (x, y, color) => `<path d="M${x} ${y-11}L${x+3} ${y-3}L${x+11} ${y}L${x+3} ${y+3}L${x} ${y+11}L${x-3} ${y+3}L${x-11} ${y}L${x-3} ${y-3}Z" fill="${color}" stroke="#504051" stroke-width="2" stroke-linejoin="round"/>`;
const specs = [
  {id:'ema', hair:'#dce5f7', shade:'#ee8aac', eyes:'#e85783', skin:'#fff0e9', outline:'#6e6172', fringe:'M42 55Q53 14 98 20Q129 15 156 48Q139 44 129 36Q119 56 108 62Q99 58 98 41Q83 65 72 64Q65 61 67 43Q56 59 42 55Z', extra:`<path d="M37 82Q33 101 49 108L59 92M153 81Q165 101 151 111L141 91" fill="#eb91ad" stroke="#6e6172" stroke-width="3"/><path d="M77 11Q109 -2 145 13Q154 20 153 32Q129 22 103 26Q88 18 77 11Z" fill="#252936" stroke="#4d4554" stroke-width="4"/>${flower(133,27,'#fff8f3','#e893b4')}${flower(146,32,'#f8c1d1','#f2df9b')}<path d="M98 39l10 11m0-11L98 50" stroke="#282a32" stroke-width="5" stroke-linecap="round"/><path d="M80 115Q100 125 120 115" fill="none" stroke="#2c3038" stroke-width="5"/>`},
  {id:'hiro', hair:'#24222c', shade:'#7a263b', eyes:'#bc314b', skin:'#fff0e8', outline:'#5a3b46', fringe:'M39 56Q40 11 100 19Q153 15 161 57Q148 49 139 37Q130 62 117 64Q111 50 109 35Q96 65 83 66Q70 50 68 37Q57 59 39 56Z', extra:`<path d="M39 31L19 17L27 47L13 52L36 59" fill="#a62643" stroke="#5a2736" stroke-width="4"/>${star(34,31,'#d33553')}${flower(44,37,'#a82544','#2a222b')}<path d="M55 45L44 67" stroke="#a52742" stroke-width="5"/>`},
  {id:'annan', hair:'#e0e7fa', shade:'#bccce8', eyes:'#7c70b2', skin:'#fcefe9', outline:'#626785', fringe:'M37 50Q52 21 97 20Q141 19 163 49Q143 45 126 35Q118 59 103 62Q91 57 91 39Q75 67 62 64L64 37Q52 53 37 50Z', extra:`<path d="M40 30Q51 2 99 6Q146 4 161 32" fill="none" stroke="#243c80" stroke-width="11" stroke-linecap="round"/><path d="M44 28Q99 -3 158 29" fill="none" stroke="#7995c2" stroke-width="3" stroke-dasharray="7 5"/>${bow(158,43,'#273875')}<path d="M44 44v37M156 43v37" stroke="#253879" stroke-width="6"/>`},
  {id:'noah', hair:'#ccd5f5', shade:'#53d4b9', eyes:'#e97a55', rightEye:'#e7ad36', skin:'#fff1e6', outline:'#596587', fringe:'M39 52Q59 13 105 22Q151 20 162 50L140 48L135 37L117 61L111 37L95 61L90 39L73 61L66 39L53 55Z', extra:`<path d="M42 25Q52 5 101 5Q149 4 158 23L154 35Q109 23 48 36Z" fill="#27354e" stroke="#3f4b68" stroke-width="4"/><path d="M75 42L70 61M88 39l-2 18M101 40l1 18M114 39l5 17" stroke-width="7" stroke-linecap="round" stroke="#e6735b"/><path d="M84 40l-1 18M96 40l1 18M106 40l2 17" stroke-width="6" stroke="#9ed04e"/><circle cx="134" cy="16" r="5" fill="#e2417e"/><circle cx="145" cy="19" r="5" fill="#47bbd2"/><circle cx="153" cy="26" r="5" fill="#e4bd47"/>`},
  {id:'reia', hair:'#b7a89e', shade:'#988275', eyes:'#bb813a', skin:'#fff0e6', outline:'#6d625d', fringe:'M39 50Q53 17 94 18Q145 13 161 48Q148 48 137 38Q125 61 110 63L105 39Q92 64 79 65L77 39Q60 56 39 50Z', extra:`${star(152,32,'#e2b15a')}<path d="M148 20l13-12m-16 20l18-2m-17 12l14 8" stroke="#383943" stroke-width="5" stroke-linecap="round"/><path d="M56 103Q60 117 75 120M144 103Q140 117 125 120" fill="none" stroke="#826b61" stroke-width="5"/>`},
  {id:'miria', hair:'#edc27a', shade:'#f0d699', eyes:'#58a7cc', skin:'#fff1e9', outline:'#92705a', fringe:'M39 51Q51 17 100 19Q151 17 162 53L139 48L135 37Q116 59 102 60Q89 56 86 37Q68 58 39 51Z', extra:`<path d="M43 73Q29 91 48 110M157 73Q171 91 152 110" fill="none" stroke="#d9a66b" stroke-width="12" stroke-linecap="round"/>${bow(148,33,'#2f303c')}<path d="M155 37q15 14 4 36" fill="none" stroke="#292d3b" stroke-width="5"/>`},
  {id:'margo', hair:'#292634', shade:'#684575', eyes:'#9866b1', skin:'#ffefe8', outline:'#594558', fringe:'M37 54Q52 17 99 20Q142 14 164 51Q143 48 131 36Q114 59 105 59Q92 53 91 39Q71 66 57 63L60 38Z', extra:`<path d="M44 24Q75 3 105 13Q131 3 157 24L151 35Q113 23 50 36Z" fill="#25252f" stroke="#594558" stroke-width="4"/>${flower(53,21,'#a688d6','#f2d6c5')}${flower(65,16,'#dbd6e9','#cfbb65')}${star(143,40,'#af8ccd')}<path d="M40 77Q28 92 43 108" fill="none" stroke="#6b4289" stroke-width="7"/>`},
  {id:'nanoka', hair:'#242632', shade:'#464b62', eyes:'#8f99ae', skin:'#f0eceb', outline:'#555461', fringe:'M39 55Q45 20 99 18Q153 17 162 54Q145 44 134 36Q118 62 104 64L102 38Q86 63 72 65L68 38Q57 55 39 55Z', extra:`<path d="M42 25Q40 9 62 9H138Q160 8 158 27L154 36Q102 22 46 36Z" fill="#292e3c" stroke="#4f5361" stroke-width="4"/><path d="M54 12h30l4 13H51ZM118 12h28l4 13h-30Z" fill="#515767" stroke="#777b87" stroke-width="3"/>`},
  {id:'arisa', hair:'#9397a9', shade:'#b63f58', eyes:'#b83855', skin:'#f2e5df', outline:'#5f5b70', fringe:'M43 60Q47 22 100 19Q148 21 158 59Q140 49 132 38Q119 61 105 64L100 40Q85 65 69 65L65 41Q58 57 43 60Z', extra:`<path d="M44 25Q40 9 64 8Q105 -2 145 13Q162 19 158 43L151 76Q143 43 128 30Q100 19 72 31Q53 43 49 81Z" fill="#282d3c" stroke="#505368" stroke-width="4"/><path d="M70 44l11 14m0-14L70 58" stroke="#393742" stroke-width="4"/><path d="M54 86Q100 80 146 86L145 106Q100 119 55 106Z" fill="#282631" stroke="#55505d" stroke-width="3"/><path d="M44 84l-4 25M156 84l4 25" stroke="#b63f58" stroke-width="7"/>`, noMouth:true},
  {id:'sherie', hair:'#4e9ed1', shade:'#2174b4', eyes:'#e8a251', skin:'#fff1e7', outline:'#496b83', fringe:'M40 54Q52 18 102 20Q149 18 160 54Q140 49 130 39Q114 61 102 61L96 38Q77 62 61 61L64 40Z', extra:`<path d="M40 26Q53 3 103 9Q147 5 161 27L152 36Q105 23 46 38Z" fill="#26384c" stroke="#496b83" stroke-width="4"/>${flower(148,23,'#4da9d8','#e5d9a1')}${bow(151,47,'#2761a1')}<path d="M38 87Q28 99 43 114M162 87Q172 99 157 114" fill="none" stroke="#227ac2" stroke-width="8"/>`},
  {id:'hanna', hair:'#d9b19f', shade:'#efd1bd', eyes:'#80a44e', skin:'#fff2e9', outline:'#856c66', fringe:'M38 51Q55 14 100 19Q147 15 163 54Q145 48 134 36Q121 59 106 61L102 37Q86 61 72 61L67 40Z', extra:`<path d="M38 31Q52 5 99 8Q145 4 163 32" fill="none" stroke="#5d744b" stroke-width="10"/><circle cx="55" cy="21" r="9" fill="#c7a65b" stroke="#81684e" stroke-width="3"/>${flower(143,25,'#e6bd67','#f5e3a5')}${flower(73,13,'#e4dfcf','#8daa65')}<path d="M41 81Q27 95 41 116M159 81Q173 95 159 116" fill="none" stroke="#b99582" stroke-width="9"/>`},
  {id:'koko', hair:'#252731', shade:'#e27339', eyes:'#c97844', skin:'#fff0e8', outline:'#5a4850', fringe:'M39 57Q46 20 98 20Q153 17 161 59Q144 47 133 39Q121 61 105 64L99 40Q83 67 67 65L65 41Q53 55 39 57Z', extra:`<path d="M43 31L31 11L61 21M157 31l12-20l-30 10" fill="#30313c" stroke="#5a4850" stroke-width="4"/><path d="M43 26L37 17L52 22M157 26l6-9l-15 5" fill="#e86f42"/>${bow(150,55,'#d9653e')}<circle cx="63" cy="43" r="3" fill="#e8793c"/><path d="M94 99l6 5l6-5" fill="#fff" stroke="#694750" stroke-width="2"/>`},
  {id:'meruru', hair:'#d9dce9', shade:'#b9c5dd', eyes:'#777c9f', skin:'#fff0e9', outline:'#7c7c93', fringe:'M38 55Q53 17 99 18Q143 15 163 55Q139 51 129 39Q116 62 103 63L99 39Q83 64 68 64L65 39Z', extra:`<path d="M42 23Q57 -1 100 8Q139 0 158 23L156 62Q135 36 100 34Q63 35 44 62Z" fill="#f7f8fa" stroke="#858aa4" stroke-width="4"/><path d="M52 16L40 38l12 7l-12 14M148 16l12 22l-12 7l12 14" fill="none" stroke="#8d94ae" stroke-width="5"/><path d="M46 91Q40 112 66 119M154 91q6 21-20 28" fill="none" stroke="#b6bfda" stroke-width="7"/>`},
];

for (const c of specs) {
  if (c.id === 'ema') {
    writeFileSync(resolve(root, 'ema.svg'), emaSvg);
    continue;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 132">
<ellipse cx="100" cy="124" rx="66" ry="6" fill="#143d30" opacity=".13"/>
<path d="M35 78Q32 29 77 20Q101 11 126 20Q168 29 165 78Q163 120 101 122Q37 122 35 78Z" fill="${c.hair}" stroke="#372c35" stroke-width="4" stroke-linejoin="round"/>
<path d="M42 81Q43 42 100 38Q157 42 158 81Q155 117 100 120Q45 117 42 81Z" fill="${c.skin}" stroke="#372c35" stroke-width="3"/>
<path d="M41 78Q33 94 51 112L62 99L59 65M159 78Q167 94 149 112L138 99L141 65" fill="${c.shade}" stroke="#372c35" stroke-width="3" stroke-linejoin="round"/>
<path d="${c.fringe}" fill="${c.hair}" stroke="#372c35" stroke-width="3.5" stroke-linejoin="round"/>
<ellipse cx="71" cy="82" rx="9" ry="11" fill="#634550"/><ellipse cx="129" cy="82" rx="9" ry="11" fill="#634550"/>
<ellipse cx="71" cy="82" rx="7" ry="9" fill="${c.eyes}"/><ellipse cx="129" cy="82" rx="7" ry="9" fill="${c.rightEye ?? c.eyes}"/>
<circle cx="74" cy="78" r="2.5" fill="#fff9ee"/><circle cx="132" cy="78" r="2.5" fill="#fff9ee"/>
<ellipse cx="58" cy="97" rx="11" ry="6" fill="#eaa4a0" opacity=".72"/><ellipse cx="142" cy="97" rx="11" ry="6" fill="#eaa4a0" opacity=".72"/>
${c.noMouth ? '' : '<path d="M93 105Q100 111 107 105" fill="none" stroke="#8f5262" stroke-width="3" stroke-linecap="round"/>'}
${c.extra}
</svg>\n`;
  writeFileSync(resolve(root, `${c.id}.svg`), svg);
}
