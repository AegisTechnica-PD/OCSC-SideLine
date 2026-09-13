import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

// ---------- Theme ----------
const C = {
  pitch: "#1B1B1F",
  pitchDeep: "#0C0C0E",
  panel: "#151518",
  chalk: "#FAFAF8",
  chalkDim: "rgba(250,250,248,0.55)",
  line: "rgba(250,250,248,0.25)",
  volt: "#E01F2D",
  coral: "#E01F2D",
  sky: "#FAFAF8",
};

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Nunito:wght@400;700;800&display=swap');
@keyframes pulseDot { 0%,100%{ transform:scale(1); opacity:1;} 50%{ transform:scale(1.25); opacity:.75;} }
@keyframes popIn { 0%{ transform:scale(.92); opacity:0;} 100%{ transform:scale(1); opacity:1;} }
@keyframes slideUp { 0%{ transform:translateY(10px); opacity:0;} 100%{ transform:translateY(0); opacity:1;} }
@media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; } }
`;

// ---------- Positions & field layout (3-4-1, 9v9) ----------
export const POSITIONS = ["Goalkeeper", "Left Defender", "Center Defender", "Right Defender", "Defensive Midfielder", "Left Midfielder", "Center Midfielder", "Right Midfielder", "Striker"];

// x: 0 (left) to 100 (right), y: 0 (own goal, bottom) to 100 (their goal, top)
const FIELD_SPOTS = {
  "Goalkeeper": { x: 50, y: 7 },
  "Left Defender": { x: 22, y: 24 },
  "Center Defender": { x: 50, y: 21 },
  "Right Defender": { x: 78, y: 24 },
  "Defensive Midfielder": { x: 50, y: 40 },
  "Left Midfielder": { x: 15, y: 57 },
  "Center Midfielder": { x: 50, y: 61 },
  "Right Midfielder": { x: 85, y: 57 },
  "Striker": { x: 50, y: 83 },
};

const PRINCIPLES = {
  "Stay Connected": { color: "#FAFAF8" },
  "Win It Back Together": { color: "#E01F2D" },
  "Play Out Calmly": { color: "#A6A6AD" },
  "Attack the Gap Fast": { color: "#FF6B75" },
};


// ---------- Question bank ----------
// pos: whose scenario this is ("Team" = everyone)
// hi: every position involved in the scenario — all get highlighted on the field.
//     First entry is the "you" position (bright); the rest light up in blue.
const QUESTIONS = [
  // Goalkeeper
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper", "Left Defender"],
    q: "You catch the ball and every teammate near you is covered. What's the smart play?",
    opts: ["Boot it long down the middle right away", "Hold it, scan, and roll wide to the Left Defender", "Throw it fast to the nearest teammate"],
    a: 1, why: "Calm beats fast. Wide areas are the safest place to start our attack — wait for a defender to get open, then roll it clean." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper"],
    q: "The ball is way down at the other end of the field. Where should you be?",
    opts: ["Stay back on your goal line and watch", "Wait near the edge of your box to sweep long balls", "Push all the way up to midfield with the team"],
    a: 1, why: "You stay connected to the back line. Near the top of the box you can clean up any ball played in behind our defenders." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper", "Right Defender"],
    q: "Your defenders can't see the runners behind them. What's your job?",
    opts: ["Stay quiet so you don't distract them", "Shout early, loud instructions to your defenders", "Sprint out and cover the runner yourself"],
    a: 1, why: "The Goalkeeper is the eyes of the defense. Loud and early: 'Right Defender — runner behind you!' helps the whole team defend together." },

  // Left Defender
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender", "Goalkeeper", "Left Midfielder"],
    q: "The Goalkeeper rolls you the ball. One opponent is jogging toward you. Best move?",
    opts: ["Clear it out of bounds before she arrives", "Touch up the line and look for the Left Midfielder", "Cut inside and dribble toward the middle"],
    a: 1, why: "One jogging opponent is not real pressure. Touch forward, head up, and play calm up your side of the field." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Center Defender"],
    q: "The ball is over on the right side of the field. Where do you go?",
    opts: ["Hold your spot wide on the left sideline", "Tuck in toward the Center Defender to close the gaps", "Push forward to start our next attack"],
    a: 1, why: "When the ball is far from you, tuck in. A connected back line has no gaps to run through." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender", "Left Midfielder", "Center Defender"],
    q: "The Left Midfielder loses the ball right in front of you. What now?",
    opts: ["Hold your position and let her chase it", "Step up and press while the Center Defender covers", "Drop back toward the Goalkeeper to be safe"],
    a: 1, why: "Win it back together means the closest player presses right away — and a teammate covers the space behind." },

  // Center Defender
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender", "Left Defender", "Right Defender"],
    q: "Our team pushes up into the attack. What does the back line do?",
    opts: ["Hold the edge of our own box just in case", "Step up together, level with the other defenders", "Send one defender up and keep two back"],
    a: 1, why: "The back three moves like one unit. Stepping up together keeps us close enough to support the attack — and keeps opponents from hiding behind us." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender", "Striker"],
    q: "You win a tackle and look up — open grass ahead and the Striker is starting a run. Best choice?",
    opts: ["Play it safely back to the Goalkeeper", "Hit the gap early for the Striker's run", "Carry it slowly and let everyone get set"],
    a: 1, why: "The moment we win the ball is when their defense is most scrambled. See a gap? Attack it fast." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender", "Goalkeeper"],
    q: "Goal kick. What should you be doing?",
    opts: ["Hold your spot and wait for the kick", "Move wide to an open angle and call for it", "Push up the field for the long ball"],
    a: 1, why: "Playing out calmly starts before the pass. Give the Goalkeeper an easy angle and a loud call so we keep the ball." },

  // Right Defender
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender", "Defensive Midfielder"],
    q: "Their fastest winger is dribbling straight at you. What's the plan?",
    opts: ["Tackle her before she builds up speed", "Slow her down goal-side until help doubles in", "Drop off fast toward your own goal"],
    a: 1, why: "Delay, don't dive. When you slow her down, help arrives — and two defenders win the ball way more often than one." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Center Defender"],
    q: "The Center Defender steps up to press a player at midfield. What do you do?",
    opts: ["Hold your channel out on the right side", "Pinch in behind her to cover the middle", "Step up beside her to double the press"],
    a: 1, why: "When one defender steps out, the others slide to cover. Connected means no open door in the middle." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender", "Goalkeeper"],
    q: "You receive from the Goalkeeper and hear footsteps closing fast behind you. Best option?",
    opts: ["Shield it and try to spin away from her", "One touch back to the Goalkeeper, then move again", "Clear it hard up the field right away"],
    a: 1, why: "Backward is not scared — backward keeps the ball ours. Bounce it back, move, and get it again in space." },

  // Defensive Midfielder
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder", "Left Defender", "Center Defender", "Right Defender"],
    q: "Our team is attacking in their half. Where do you live?",
    opts: ["Push into their box as an extra attacker", "Hold in front of our back three, guarding the middle", "Slide wide to support the sideline attack"],
    a: 1, why: "You're the shield. Staying between the ball and our back line means their counterattack runs straight into you." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder"],
    q: "We lose the ball at midfield, close to you. First thing you do?",
    opts: ["Press the ball right away — you're closest", "Drop back to shield the back three first", "Hold your spot and block the middle lane"],
    a: 0, why: "First five seconds after we lose it is the best time to steal it back. Closest player presses NOW." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder", "Center Defender"],
    q: "The Center Defender is about to pass to you and an opponent is sneaking up behind you. What's your pre-pass habit?",
    opts: ["Lock your eyes on the ball coming in", "Check over your shoulder before it arrives", "Wave the pass off and reset the play"],
    a: 1, why: "Scan first, then receive. One shoulder check tells you: turn, or play it back safe." },

  // Left Midfielder
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder", "Center Midfielder"],
    q: "The Center Midfielder just won the ball. What's your best run?",
    opts: ["Check toward her for the short pass", "Sprint up the line into the space behind them", "Hold wide and wait for the ball to arrive"],
    a: 1, why: "The second we win it, gaps appear. Your sprint up the line gives us a fast way forward before they reset." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder", "Defensive Midfielder"],
    q: "You just lost the ball trying a dribble. What now?",
    opts: ["Get back into your spot in our shape", "Chase it hard for five seconds right away", "Let the Defensive Midfielder deal with it"],
    a: 1, why: "Everyone loses balls — champions chase them. Your instant press either wins it back or slows them way down." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder", "Center Midfielder"],
    q: "The ball is on the right sideline and we're defending. Where are you?",
    opts: ["Hold your width out on the left line", "Tuck toward the middle, within a pass of the team", "Push high next to the Striker for the counter"],
    a: 1, why: "Defend narrow, attack wide. Tucking in keeps the team connected so there's no giant hole in our middle." },

  // Right Midfielder
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder", "Right Defender"],
    q: "The Right Defender passes to you and a defender is glued to your back. Best option?",
    opts: ["Spin quickly and try to beat her", "First touch away, or bounce it straight back", "Let it run through and turn after it"],
    a: 1, why: "Tight defender behind you? Don't force the turn. First touch away from pressure, or play it back and spin into new space." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder", "Striker"],
    q: "You have the ball wide and see daylight between two of their defenders. What do you do?",
    opts: ["Keep it safe with a pass backward", "Slide it through the gap for the Striker's run", "Hold it wide and pull more defenders out"],
    a: 1, why: "Gaps close in seconds. See it, play it — that pass through the gap is how we score." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder", "Left Defender"],
    q: "Our Left Defender has the ball on the far side. How do you help from all the way over on the right?",
    opts: ["Stay put — it's too far away to matter", "Shrink the distance so passes can travel across the team", "Sprint all the way over to the left side"],
    a: 1, why: "Connected means the ball can always travel player-to-player. Shrink the distance a little and you're a real option." },

  // Center Midfielder
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder", "Striker"],
    q: "You receive the ball facing their goal and their defense isn't set yet. What's the move?",
    opts: ["Turn back and recycle it to the defenders", "Go now — drive at the gap or find the Striker", "Slow it down and let the team move up"],
    a: 1, why: "Facing forward with a scrambled defense is gold. Attack the gap before it closes." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder", "Striker"],
    q: "The Striker chases a long ball by herself. What do you do?",
    opts: ["Hold the middle in case it bounces back", "Sprint to get within one pass of her", "Send the wide players up to help her"],
    a: 1, why: "One teammate within a pass turns a lost cause into an attack. Nobody fights alone." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder"],
    q: "They played a pass through our midfield and are attacking. What's your recovery run?",
    opts: ["Chase the ball wherever it travels", "Sprint back goal-side, between the ball and our goal", "Push up and wait for our next attack"],
    a: 1, why: "Recover toward our goal first. Goal-side position wins games; ball-chasing leaves highways open." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder", "Defensive Midfielder"],
    q: "It's crowded in the middle and nothing is open going forward. What's the calm answer?",
    opts: ["Thread it through the crowd anyway", "Use the Defensive Midfielder to switch sides", "Dribble sideways until something opens up"],
    a: 1, why: "When one side is jammed, the other side is open. Back and around beats forced and lost." },

  // Striker
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker", "Center Defender"],
    q: "Our Center Defender wins the ball and looks up. What's your job?",
    opts: ["Drop deep to give her a short option", "Time a run behind their last defender", "Hold your spot and wait for the pass"],
    a: 1, why: "Your run IS the attack. Time it as the pass is hit, stay onside, and go." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker"],
    q: "Their goalkeeper rolls the ball to their defender. You're the closest player. What do you do?",
    opts: ["Drop back into our defensive shape", "Press her first touch with a curved run", "Wait at midfield and save your energy"],
    a: 1, why: "You're our first defender. A smart, curved press forces a panic kick — and that's how we win it back high." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker"],
    q: "We're pinned in our own half defending a lot. Where should you be?",
    opts: ["Drop into our box and help defend", "Stay near the center circle as our outlet", "Push up next to their last defender"],
    a: 1, why: "You're the escape hatch. If you're reachable, one clearance to you flips the whole game." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker", "Center Midfielder"],
    q: "You receive with your back to goal and a defender pushing on you. Best play?",
    opts: ["Spin fast and get a shot away", "Hold her off, lay it back to a midfielder", "Flick it forward and chase after it"],
    a: 1, why: "Back to goal + tight defender = hold and lay it back. The Center Midfielder arrives facing forward — that's the real chance." },

  // Team / formation knowledge
  { pos: "Team", pr: "Win It Back Together", hi: [],
    q: "When is the EASIEST time to win the ball back after we lose it?",
    opts: ["Once they've made a few tired passes", "In the first five seconds after we lose it", "When their defenders have it at the back"],
    a: 1, why: "Right after a steal, they haven't organized yet. Five hard seconds of pressing wins more balls than five minutes of chasing." },
  { pos: "Team", pr: "Stay Connected", hi: [],
    q: "What does 'Stay Connected' actually mean on the field?",
    opts: ["Everyone stays tight together close to the ball", "Every player is within one good pass of a teammate", "Wide players always stay out on their sidelines"],
    a: 1, why: "Connected = pass-able. If the ball can always travel to someone in our shirt, we're never trapped." },
  { pos: "Team", pr: "Attack the Gap Fast", hi: [],
    q: "In soccer, what is a 'gap'?",
    opts: ["The space between or behind defenders", "The distance between our two lines", "The open area near the corner flags"],
    a: 0, why: "Gaps are open grass between or behind defenders. Finding them fast — with a run or a pass — is how we break teams down." },
  { pos: "Team", pr: "Play Out Calmly", hi: [],
    q: "You're under pressure and there's no forward pass. Is passing backward okay?",
    opts: ["No — always find a way to go forward", "Yes — backward keeps the ball ours", "Only when the Goalkeeper calls for it"],
    a: 1, why: "Keeping the ball is winning. Back, around, and forward again beats a 50/50 punt every time." },
  { pos: "Team", pr: "Stay Connected", hi: ["Left Defender", "Center Defender", "Right Defender"],
    q: "In our 3-4-1, how many defenders are in the back line?",
    opts: ["Two, with the Defensive Midfielder dropping in", "Three — Left, Center, and Right Defenders", "Four across the back plus the Goalkeeper"],
    a: 1, why: "Three in the back: Left Defender, Center Defender, Right Defender — with the Goalkeeper behind them and the Defensive Midfielder shielding in front." },
  { pos: "Team", pr: "Stay Connected", hi: ["Defensive Midfielder", "Left Defender", "Center Defender", "Right Defender"],
    q: "Who guards the space right in front of our back three?",
    opts: ["The Center Midfielder drops in to do it", "The Defensive Midfielder — she's the shield", "The nearest wide midfielder tucks in"],
    a: 1, why: "The Defensive Midfielder is the shield. Counterattacks through the middle have to get past her first." },
  { pos: "Team", pr: "Attack the Gap Fast", hi: ["Left Midfielder", "Right Midfielder"],
    q: "Which two players give our midfield its width?",
    opts: ["The Left and Right Midfielders", "The Left and Right Defenders pushing up", "The Center Midfielder drifting side to side"],
    a: 0, why: "Left Midfielder and Right Midfielder stretch the field side-to-side — wide players make gaps open up in the middle." },
  { pos: "Team", pr: "Attack the Gap Fast", hi: ["Striker"],
    q: "Who is our highest player up the field in the 3-4-1?",
    opts: ["The Center Midfielder when she pushes up", "The Striker leading the line", "Whoever made the last forward run"],
    a: 1, why: "The Striker leads the line — highest player, first defender when they have it, first runner when we win it." },

  // ---- Added bank: Goalkeeper ----
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper"],
    q: "A shot deflects and the ball is bouncing loose in your box. What do you do?",
    opts: ["Hold your line and watch it develop", "Shout 'KEEPER!' and attack it with your hands", "Let your defenders clear it away first"],
    a: 1, why: "Loose balls in the box belong to you. A loud call freezes everyone else and a brave claim ends the danger." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper", "Striker"],
    q: "You catch a cross and notice their whole team pushed way up the field. Best play?",
    opts: ["Slow it down and let our shape reset", "Release fast toward the Striker before they recover", "Roll it short and build patiently from the back"],
    a: 1, why: "That's a counterattack moment. Their defense is out of position for a few seconds — a fast release turns your save into our chance." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper", "Right Defender"],
    q: "A teammate passes back to you and their forward is chasing it hard. What now?",
    opts: ["Scoop it up before she gets there", "Calm touch aside, then find the open defender", "Blast it long before the pressure arrives"],
    a: 1, why: "You can't use hands on a pass back from a teammate's foot — and you don't need to. One calm touch away from the runner, then play to the open side." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper", "Center Defender"],
    q: "They have a corner kick against us. What's your job before the ball comes in?",
    opts: ["Hold your line and focus on the ball", "Direct traffic — make sure everyone knows her mark", "Stand at the near post and guard it"],
    a: 1, why: "You see the whole box. Ten seconds of loud organizing before the kick prevents the scramble after it." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper"],
    q: "An attacker breaks free and it's just you and her. What's the plan?",
    opts: ["Hold your line and get ready to dive", "Come out, narrow the angle, and stay big", "Rush her at full speed to force the shot"],
    a: 1, why: "Coming out shrinks the goal she can see. Stay big and patient — make HER make the decision first." },

  // ---- Added bank: Left Defender ----
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender", "Left Midfielder"],
    q: "You steal the ball and the sideline ahead of you is wide open. What do you do?",
    opts: ["Find a safe pass back to the Goalkeeper", "Drive forward into the open space yourself", "Wait for the Left Midfielder to come short"],
    a: 1, why: "Open grass is an invitation. Defenders who join the attack surprise everyone — the Left Midfielder will balance behind you." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Goalkeeper"],
    q: "The Goalkeeper has the ball and an opponent is standing right next to you. How do you help?",
    opts: ["Hold still so she knows where you are", "Drop wider and deeper into an open lane", "Sprint upfield to stretch their defense"],
    a: 1, why: "Standing still keeps you covered. A few quick steps into open space gives the Goalkeeper a real option — connected means reachable." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender", "Center Defender"],
    q: "Their winger tries to cut inside past you toward the middle. What do you do?",
    opts: ["Follow her inside and stay touch-tight", "Angle your body to steer her down the sideline", "Back off and protect the box behind you"],
    a: 1, why: "The sideline is an extra defender — it never gets beaten. Show her the outside and the field shrinks around her." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender", "Defensive Midfielder"],
    q: "You're pressured on the sideline and there's no pass up the line. Where's the escape?",
    opts: ["Clear it hard down the sideline", "Play inside to the Defensive Midfielder to switch it", "Shield it and try to win a throw-in"],
    a: 1, why: "When the sideline is jammed, the middle is the door. The Defensive Midfielder can move the ball to the open side of the field." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Center Defender"],
    q: "Our attack on your side just broke down and the ball is coming back. What's your first job?",
    opts: ["Watch the ball and read where it's going", "Sprint back goal-side into your spot in the line", "Press the ball carrier before she settles"],
    a: 1, why: "Recovery runs win games nobody claps for. Get goal-side and connected to the Center Defender before the ball beats you there." },

  // ---- Added bank: Center Defender ----
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender", "Left Defender", "Right Defender"],
    q: "Their striker stands between you and our goal, waiting for a through ball. How do you defend her?",
    opts: ["Stand right beside her the whole play", "Stay goal-side, then get tight as the ball travels", "Back off and guard the space behind you"],
    a: 1, why: "Goal-side first, tight on arrival. If you're touching her when the ball arrives, she can't turn — and the back line stays in control." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender", "Defensive Midfielder"],
    q: "The Defensive Midfielder receives with her back to goal and can't turn. How do you help?",
    opts: ["Call for her to switch it wide fast", "Drop a few steps and give her a back-pass option", "Push up so she has a forward target"],
    a: 1, why: "A safe pass backward resets everything. Being her escape option IS defending — trapped teammates lose balls." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender", "Center Midfielder"],
    q: "You intercept a pass and see the Center Midfielder open between their midfield and defense. Best ball?",
    opts: ["Play it wide to a defender first", "Hit the Center Midfielder's feet right away", "Carry it forward until someone presses you"],
    a: 1, why: "A pass that skips a line of their players is the fastest legal way forward. Hit it firm while the window is open." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender", "Goalkeeper"],
    q: "A bouncing ball comes to you with a forward closing fast. What's the calm play?",
    opts: ["Chest it down and shield until help comes", "One clean touch back to the Goalkeeper, then move", "Volley it clear as far as you can"],
    a: 1, why: "Bouncing ball + pressure = keep it simple. Use the Goalkeeper, move your feet, and we still have the ball." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender"],
    q: "Two attackers are coming at you alone on a breakaway — a 2v1. What do you do?",
    opts: ["Attack the ball carrier before they settle", "Backpedal, protect the middle, and slow them down", "Mark the open runner and force the dribble"],
    a: 1, why: "In a 2v1, time is your teammate. Delay, stay between them and the goal, and our recovery runs turn 2v1 back into 2v3." },

  // ---- Added bank: Right Defender ----
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender", "Right Midfielder"],
    q: "You win the ball and the Right Midfielder is already sprinting up the line. Best choice?",
    opts: ["Hold it until she checks back to feet", "Play it early into the space ahead of her run", "Switch it across to the other sideline"],
    a: 1, why: "Pass to where she's GOING, not where she is. An early ball up the line turns her sprint into an attack." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Goalkeeper", "Center Defender"],
    q: "We have a goal kick. Where do you go?",
    opts: ["Hold the edge of the box for a header", "Split wide toward the corner for a passing angle", "Push to midfield to win the second ball"],
    a: 1, why: "Wide and open is where playing out starts. Your angle stretches their press and gives the Goalkeeper a safe first pass." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender", "Defensive Midfielder"],
    q: "We lose the ball in the middle and their winger takes off down your side. First move?",
    opts: ["Chase the ball to force a quick pass", "Sprint back goal-side before the pass arrives", "Angle over and wait at the halfway line"],
    a: 1, why: "Beat the pass, not the player. If you're goal-side when the ball arrives, her speed doesn't matter anymore." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender", "Right Midfielder"],
    q: "You receive the ball and nobody is pressuring you at all. What should you do?",
    opts: ["Send it long while you have the time", "Head up, carry it forward, make them come to you", "Play it quickly back to the Goalkeeper"],
    a: 1, why: "No pressure means free yards. Dribbling forward forces someone to leave their spot — and that opens a gap somewhere else." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Center Defender"],
    q: "They have a throw-in deep on your side. How do you defend it?",
    opts: ["Guard the open space near the sideline", "Mark your player tight and stay goal-side", "Drop to the box and protect the goal"],
    a: 1, why: "Throw-ins are sneaky restarts. Tight and goal-side before the ball moves means no easy catch-and-turn for them." },

  // ---- Added bank: Defensive Midfielder ----
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder", "Center Midfielder"],
    q: "The Center Midfielder drifts wide to help an attack. What happens to the middle?",
    opts: ["Hold your spot — she'll be right back", "Slide over to balance the middle", "Follow her wide to support the attack"],
    a: 1, why: "Someone always minds the middle. When she goes, you cover — that's how the team stays one connected shape." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder", "Center Defender"],
    q: "Their striker drops back toward midfield to receive a pass. What do you do?",
    opts: ["Pass her off to the Center Defender", "Step tight and arrive as the ball arrives", "Hold your zone and block the lane behind her"],
    a: 1, why: "Arrive with the ball. Tight on her first touch means she plays backward — and the attack dies right there." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder", "Goalkeeper", "Center Defender"],
    q: "We're building from the back and one opponent stands between you and the Center Defender. How do you get the ball?",
    opts: ["Call for it over the top instead", "Slide sideways into a window she can see", "Come all the way to the ball for a short pass"],
    a: 1, why: "Hiding behind a defender means no pass exists. Small sideways moves open windows — that's how calm build-up works." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder", "Striker"],
    q: "You intercept a pass in midfield and look up — the Striker is peeling off her defender. Best play?",
    opts: ["Keep it safe with a sideways pass", "Play forward early into the Striker's path", "Dribble at their midfield to draw them in"],
    a: 1, why: "Forward first. One good pass right after a steal can skip their whole midfield while they're still turned around." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder"],
    q: "They're countering at us with numbers. You're the first one back. What's your job?",
    opts: ["Win it with a hard early tackle", "Delay them and steer wide while help recovers", "Drop straight back to the edge of our box"],
    a: 1, why: "You can't win it alone against numbers — so buy seconds. Every second you delay, another red shirt gets back." },

  // ---- Added bank: Left Midfielder ----
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder", "Left Defender"],
    q: "The Left Defender is under pressure with the ball. How do you help her?",
    opts: ["Make a long run for the ball over the top", "Come short down the line, then give-and-go", "Pull your defender away to clear the space"],
    a: 1, why: "Short support beats hero balls. A quick wall pass around the presser keeps us calm and moving forward." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder", "Striker"],
    q: "You beat your defender on the dribble out wide. What's your very next job?",
    opts: ["Take another touch and beat the next one", "Eyes up fast — find the Striker's run", "Protect the ball and wait for support"],
    a: 1, why: "Beating a player opens a gap for seconds. Eyes up immediately — the pass you see early is the one that becomes a goal." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder", "Center Midfielder", "Striker"],
    q: "We're attacking down the RIGHT side. Where should you be?",
    opts: ["Hold your width for the long switch", "Drift toward the far post, within one pass", "Drop back to cover the counterattack"],
    a: 1, why: "Far-side players score sneaky goals. Drift in, stay connected, and the switch or the rebound finds YOU." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder", "Left Defender"],
    q: "Their defender is dribbling forward on your side of the field. Whose job is she?",
    opts: ["The Left Defender's — hold your spot", "Yours — press her while the Left Defender covers", "The Defensive Midfielder's — she slides out"],
    a: 1, why: "Wide players defend forward. You press first; the Left Defender covers behind — two connected defenders beat one dribbler." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder"],
    q: "You receive the ball wide and your defender is giving you five big yards of space. What do you do?",
    opts: ["Hold it and let the play develop", "Attack her with your first touch before she's set", "Look back inside for the safe pass"],
    a: 1, why: "Space is a gift — take it. Driving at a backing-up defender forces panic decisions all over their team." },

  // ---- Added bank: Right Midfielder ----
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder", "Right Defender"],
    q: "The Right Defender is stuck under pressure with the ball. How do you help?",
    opts: ["Clear out and take your defender with you", "Come short as an easy outlet, then give-and-go", "Call for the big switch to the far side"],
    a: 1, why: "Be the easy pass. Short support and a quick return ball beats the press without a single risky kick." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder", "Striker"],
    q: "You dribble past your defender out wide. What's the very next thing you do?",
    opts: ["Slow up and shield until help arrives", "Look up fast for the Striker's cross or cutback", "Take it all the way to the goal line first"],
    a: 1, why: "The gap you just made closes in seconds. Eyes up right away and hit the run while their defense is scrambling." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder", "Center Midfielder"],
    q: "We're attacking down the LEFT side. Where should you be?",
    opts: ["Hold your right sideline for the switch", "Drift toward the middle and far post, within a pass", "Get back and cover the Right Defender's zone"],
    a: 1, why: "Stay reachable. Far-side runners arrive unmarked — the switch, the cutback, and the rebound all belong to you." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder", "Right Defender"],
    q: "Their outside defender dribbles forward on your side. What's your job?",
    opts: ["Drop into our shape and stay compact", "Press and steer her while the Right Defender covers", "Show her inside where we have numbers"],
    a: 1, why: "You're the first defender on your side. Press and steer; with the Right Defender covering, she's got nowhere good to go." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder"],
    q: "You get the ball wide with lots of open space in front of you. Best move?",
    opts: ["Wait so the team can move up with you", "First touch forward and attack the space at speed", "Play it square and make a run instead"],
    a: 1, why: "Attack space the moment you have it. A wide player driving forward drags defenders out and rips gaps open inside." },

  // ---- Added bank: Center Midfielder ----
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder", "Defensive Midfielder"],
    q: "Their best player keeps getting the ball in the middle and hurting us. What do you do?",
    opts: ["Double-team her every time she's near", "Press her first touch and block the lane to her", "Sit deep so she can't play in behind you"],
    a: 1, why: "Take away her time. If every touch she gets comes with instant pressure, her magic disappears — the Defensive Midfielder has your back." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder", "Striker", "Defensive Midfielder"],
    q: "Your teammate has the ball but a defender is standing right between you two. What do you do?",
    opts: ["Call louder so she knows you're there", "Move a few steps into a lane she can see", "Make a long run behind their defense instead"],
    a: 1, why: "If she can't see you, you don't exist. Small, smart movements into open windows keep the whole team connected." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder"],
    q: "You receive the ball with time and space — no one is pressing you. What now?",
    opts: ["Move it on quickly — one touch, keep it safe", "Settle, get your head up, pick the best option", "Drive at their defense while they're off you"],
    a: 1, why: "Time on the ball is treasure — don't waste it panicking. Calm touch, scan, best pass." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder", "Left Midfielder", "Right Midfielder"],
    q: "The middle of the field is totally packed with their players. Where's the gap?",
    opts: ["Be patient and probe with short passes", "Switch it fast to the open wide player", "Chip it over the crowd to the Striker"],
    a: 1, why: "A crowded middle means empty wings. A fast switch makes their whole team run sideways — and gaps open as they scramble." },

  // ---- Added bank: Striker ----
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker", "Center Midfielder"],
    q: "The Center Midfielder gets the ball facing forward. What should you be doing?",
    opts: ["Hold your spot so she knows where you are", "Slide across the defender's blind side", "Come short and show for a pass to feet"],
    a: 1, why: "Standing strikers are easy to mark. Move when the passer looks up — defenders can't watch you and the ball at once." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker", "Center Midfielder"],
    q: "We're pressing their goal kick. How should you press their defender?",
    opts: ["Sprint straight at the ball at full speed", "Curve your run to push her toward the sideline", "Block the middle and force her to go wide"],
    a: 1, why: "Press with a plan. Curving your run takes away half the field — the sideline trap is where our midfield pounces." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker"],
    q: "You see a gap behind their defense but you're not sure the pass will come. Do you make the run?",
    opts: ["Save the run for when the pass is on", "Make the run anyway — runs create chances", "Point to the gap so the passer sees it"],
    a: 1, why: "Every real run drags a defender with it and opens space for teammates. Ten runs might earn one goal — make all ten." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker", "Right Midfielder"],
    q: "You receive the ball up top but the whole team is still far behind you. What's the calm play?",
    opts: ["Take on the defenders before they settle", "Shield the ball and wait for support to arrive", "Turn and shoot before the keeper is set"],
    a: 1, why: "Hold-up play is a superpower. Protect the ball for three seconds and suddenly you're not alone anymore." },

  // ---- Added bank: whole team ----
  { pos: "Team", pr: "Stay Connected", hi: [],
    q: "You want the ball but a defender is standing between you and your teammate. What do you do?",
    opts: ["Call for it louder and hold your spot", "Move to a spot where she can see you", "Point to where you want the pass played"],
    a: 1, why: "Passes travel through open lanes, not through opponents. If she can see you, she can reach you." },
  { pos: "Team", pr: "Win It Back Together", hi: [],
    q: "Two of us are near their ball carrier. How do we defend together?",
    opts: ["Both press the ball and trap her fast", "One presses the ball, one covers behind", "One presses while the other marks a passer"],
    a: 1, why: "Press and cover. If the first defender gets beaten, the second is already there — that's defending as a team." },
  { pos: "Team", pr: "Win It Back Together", hi: [],
    q: "What does 'goal-side' mean?",
    opts: ["Being between your opponent and our goal", "Being on the side where the ball is", "Being the closest player to their goal"],
    a: 0, why: "Goal-side means she has to go through you to hurt us. It's the first rule of defending anything." },
  { pos: "Team", pr: "Play Out Calmly", hi: [],
    q: "What makes a first touch a GOOD first touch?",
    opts: ["Killing the ball dead right at your feet", "Moving the ball away from pressure into space", "Pushing it far ahead so you can run onto it"],
    a: 1, why: "Your first touch is your first decision. Touch into space and you've already escaped before the defender arrives." },
  { pos: "Team", pr: "Play Out Calmly", hi: [],
    q: "What should you do in the seconds BEFORE a pass comes to you?",
    opts: ["Watch the ball all the way into your feet", "Check over your shoulder to see what's around", "Start moving toward the ball early"],
    a: 1, why: "Scan before you receive. Players who peek over their shoulder already know their next move before the ball arrives." },
  { pos: "Team", pr: "Attack the Gap Fast", hi: [],
    q: "What makes a through-ball work?",
    opts: ["A firm pass played right to her feet", "A timed run and a pass into the space", "A high ball over the top of everyone"],
    a: 1, why: "Through-balls are a team-up: the runner attacks the gap, the passer leads her into it. Space, not feet." },
  { pos: "Team", pr: "Attack the Gap Fast", hi: [],
    q: "Right after we win the ball, where do gaps usually appear?",
    opts: ["In front of our own back three", "Behind the players who were just attacking us", "Out wide near their corner flags"],
    a: 1, why: "Attackers who lose the ball are out of position for a few seconds. The space behind them is our fastest route forward." },
  { pos: "Team", pr: "Stay Connected", hi: [],
    q: "How much space should there be between our defense and our midfield?",
    opts: ["Spread out to cover the whole field", "Close enough that one good pass connects them", "As tight as possible, almost touching"],
    a: 1, why: "Big gaps between our lines are where opponents live. Compact and connected means they have nowhere to play." },

  // ---- Expanded pool (added for variety past the replay cap) ----

  // Goalkeeper — expanded
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper"],
    q: "Our Right Defender pushes up to press. Where should you shift?",
    opts: ["Stay exactly on your goal line", "Drift slightly right, toward the space she left", "Move to the far post and wait"],
    a: 1, why: "When a defender steps out, you cover the space that opens behind her \u2014 a shifted defense needs a shifted keeper." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper", "Center Defender"],
    q: "The Center Defender steps up to intercept a pass. What's your job?",
    opts: ["Watch from the goal line", "Step off your line to cover any ball played over her", "Yell at her to stay back instead"],
    a: 1, why: "When your center back steps up, you become the last line behind her \u2014 be ready to sweep." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper"],
    q: "It's a rainy, low-visibility night game. How does that change your positioning?",
    opts: ["No change \u2014 position the same as always", "Play slightly deeper since the ball skids faster", "Push all the way up to midfield"],
    a: 1, why: "Wet grass means faster, harder-to-judge bounces \u2014 a touch deeper gives you more time to react." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper", "Left Defender", "Right Defender"],
    q: "Our whole back line shifts left to follow the ball. Where do you go?",
    opts: ["Stay in the exact center of the goal", "Shift slightly left with them, not all the way", "Run over to the left post"],
    a: 1, why: "You shift with the line, but less dramatically \u2014 you still need to cover the far side if the ball switches." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper"],
    q: "The other team is building an attack, but it's still in their own half. What's your posture?",
    opts: ["Relaxed and standing still on the line", "Alert, up on your toes, tracking the ball", "Jogging out to midfield to help"],
    a: 1, why: "Even when the danger is far away, staying alert and connected to the play means you're ready the instant it turns." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper", "Center Defender"],
    q: "Your Center Defender is dribbling out of the back. Where do you stand?",
    opts: ["Right next to her in case she panics", "Behind her, offering an easy safety pass", "All the way out near midfield"],
    a: 1, why: "Being an outlet behind her means she always has a calm way out if pressure arrives." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper"],
    q: "A long ball is heading toward the space between you and your defenders. What's the priority?",
    opts: ["Wait and see who gets there first", "Decide early and communicate \u2014 yours or theirs", "Stay on the line no matter what"],
    a: 1, why: "That in-between space is exactly where staying connected to your defense matters most \u2014 an early, clear call prevents chaos." },
  { pos: "Goalkeeper", pr: "Stay Connected", hi: ["Goalkeeper", "Left Defender"],
    q: "Play swings to the left touchline, far from goal. What do you do?",
    opts: ["Watch from the center of the goal", "Angle slightly toward that side, ready to cover a cross or through-ball", "Ignore it since it's far away"],
    a: 1, why: "Even on the far side of the field, staying angled toward the ball keeps you connected to the danger." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper", "Defensive Midfielder"],
    q: "The Defensive Midfielder loses the ball just outside your box. What's your role?",
    opts: ["Do nothing \u2014 that's her mistake to fix", "Organize the defense loudly while she recovers", "Come off your line to tackle it yourself"],
    a: 1, why: "The Goalkeeper is the one player who can see the whole picture \u2014 use your voice to help win it back as a unit." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper"],
    q: "An opponent through-ball splits your defenders. What's the first thing you shout?",
    opts: ["Nothing \u2014 trust them to sort it", "A clear command like 'Away!' or a name to follow the runner", "Wait until the ball is in the net"],
    a: 1, why: "A split-second loud, clear call can be the difference between a recovered ball and a goal against." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper", "Right Defender"],
    q: "Your Right Defender gets dribbled past on the wing. What do you do?",
    opts: ["Stay on your line and hope for the best", "Shout to the covering midfielder and adjust your angle", "Run out to the wing yourself"],
    a: 1, why: "You can't cover the wing yourself, but your voice can organize the recovery run that does." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper"],
    q: "Corner kick against your team. What's your responsibility before it's taken?",
    opts: ["Stand still and wait", "Organize your teammates and claim your space in the box", "Stay near the post the whole time no matter what"],
    a: 1, why: "Set pieces are won with organization \u2014 you have the best view to line everyone up." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper", "Center Defender"],
    q: "The ball squirts loose in a crowd right in front of your box. What's your call?",
    opts: ["Freeze and watch", "Shout who should attack it and who should cover behind", "Come out and grab it no matter the distance"],
    a: 1, why: "In a scramble, a clear voice sorts out who presses and who stays covering \u2014 panic is what lets goals in." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper"],
    q: "Your team just lost the ball in the attacking third. What's your job as it transitions?",
    opts: ["Relax since it's far from your goal", "Start organizing your shape immediately, before the counter builds", "Wait until the ball crosses midfield"],
    a: 1, why: "The best time to organize a defense is the instant the ball is lost \u2014 not after the counterattack is already moving." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper", "Left Defender"],
    q: "Two opponents are combining down your left side. What's the priority call?",
    opts: ["Silence \u2014 let the defenders figure it out", "Tell your Left Defender who to mark and who's covering", "Come off your line to help"],
    a: 1, why: "You see both runners at once \u2014 a clear, early call helps her deal with just one." },
  { pos: "Goalkeeper", pr: "Win It Back Together", hi: ["Goalkeeper"],
    q: "The ref blows for a foul just outside your box. What do you do while the wall sets up?",
    opts: ["Stand wherever feels comfortable", "Organize the wall and pick your best angle", "Wait for the kicker to decide for you"],
    a: 1, why: "Winning back a dangerous free kick starts with you setting the wall in the right spot." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper", "Center Defender"],
    q: "You have the ball and a fast opponent striker is closing in. What's calm and smart?",
    opts: ["Panic and boot it out of bounds", "Take a touch away from her angle and find the open Center Defender", "Dribble straight at her"],
    a: 1, why: "One good touch away from pressure is often all it takes to find the calm option." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper"],
    q: "You're about to take a goal kick. What should you check first?",
    opts: ["Just kick it as far as possible", "Scan for which teammate is in the most space", "Kick straight to the referee's whistle"],
    a: 1, why: "A goal kick is a free look at the whole field \u2014 use it to start the attack calmly, not just clear your lines." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper", "Right Defender"],
    q: "You collect a back-pass with no pressure at all. What's the move?",
    opts: ["Blast it as far as you can anyway", "Take a touch, look up, and pick the best option", "Throw it immediately without looking"],
    a: 1, why: "No pressure means no rush \u2014 this is exactly when to build calmly instead of clearing randomly." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper"],
    q: "Your defender passes back to you under a bit of pressure from a chasing forward. What now?",
    opts: ["Panic-kick it anywhere", "One controlled touch to create space, then decide", "Try to dribble around the forward"],
    a: 1, why: "A calm first touch buys you time \u2014 most 'panic clears' happen because a player rushes a decision that didn't need to be rushed." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper", "Center Defender", "Defensive Midfielder"],
    q: "Three of your teammates are calling for the ball at once. What's the calm approach?",
    opts: ["Just pick whoever yelled loudest", "Scan quickly and pick whoever is truly free of pressure", "Ignore all three and boot it long"],
    a: 1, why: "Loudest isn't always most open \u2014 a calm scan finds who's actually free." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper"],
    q: "It's 0-0 late in the game and you have the ball. Does the score change your decision-making?",
    opts: ["Yes \u2014 always go long and safe when nervous", "No \u2014 stick to the same calm process every time", "Yes \u2014 always dribble to burn time"],
    a: 1, why: "Nerves make players rush. The habit of staying calm on the ball doesn't change just because the moment feels bigger." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper", "Left Defender"],
    q: "You catch a routine shot with no danger nearby. What's next?",
    opts: ["Immediately punt it downfield", "Get up, scan the field, and pick the best restart", "Hold it for as long as possible to waste time"],
    a: 1, why: "A comfortable catch is a golden chance to start a calm attack instead of giving the ball straight back." },
  { pos: "Goalkeeper", pr: "Play Out Calmly", hi: ["Goalkeeper"],
    q: "An opponent presses you right after a back-pass, but a teammate is open behind her. What's calm?",
    opts: ["Kick it out of bounds to be safe", "Play around the pressure to your open teammate", "Try to dribble straight through her"],
    a: 1, why: "Pressure from one side almost always means space is open somewhere else \u2014 find it instead of panicking." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper", "Striker"],
    q: "You just made a big save and the Striker is already sprinting forward. What's the play?",
    opts: ["Hold the ball for 10 seconds to slow down", "Get the ball to her fast before their defense resets", "Roll it out to the nearest defender only"],
    a: 1, why: "The moment after a save is often the biggest gap of the whole game \u2014 a fast, accurate throw can start a breakaway." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper"],
    q: "You collect the ball and see the other team's defense is disorganized and spread out. What now?",
    opts: ["Slow everything down and wait for your team to catch up", "Distribute quickly to hit the gap before they reset", "Kick it out of bounds to reset play"],
    a: 1, why: "A disorganized defense is a small window \u2014 quick, accurate distribution can turn it into a goal." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper", "Left Midfielder"],
    q: "After a save, your Left Midfielder is already making a run down the open side. What's the move?",
    opts: ["Ignore the run and roll it short", "Find her early with a quick, accurate pass or throw", "Wait until she stops running"],
    a: 1, why: "A run into space only works if the ball arrives while the gap is still there." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper"],
    q: "You win the ball back deep in your own box. The other team has numbers forward \u2014 what's the priority?",
    opts: ["Take your time since you're deep", "Find the quickest safe outlet to relieve pressure and start moving forward", "Just hold it and wait"],
    a: 1, why: "Even deep in your own box, a fast, smart outlet pass can turn defense into attack before their numbers get back." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper", "Right Defender"],
    q: "A goal kick \u2014 your Right Defender has tons of space up the line. What's smart?",
    opts: ["Always kick it as high and far as possible", "Play it to her feet quickly so she can run into the space", "Kick it out of bounds for a throw-in instead"],
    a: 1, why: "Sometimes the fastest way to attack a gap is a quick pass to feet, not a long ball." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper"],
    q: "You catch a cross cleanly and the other team is badly out of shape. What's the mindset?",
    opts: ["Slow it right down, no rush at all", "Move quickly \u2014 a disorganized defense won't stay that way for long", "Just kick it straight out of bounds"],
    a: 1, why: "Gaps close fast. A quick, smart decision here can catch the other team before they recover." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper", "Center Midfielder"],
    q: "The Center Midfielder is calling for a quick throw into space behind the other team's midfield. What do you do?",
    opts: ["Ignore her and take your time", "Get her the ball quickly while the gap is open", "Wait for her to come all the way back to you"],
    a: 1, why: "A quick, accurate throw into a spotted gap can skip past defenders who haven't recovered yet." },
  { pos: "Goalkeeper", pr: "Attack the Gap Fast", hi: ["Goalkeeper"],
    q: "You just made a save on a corner kick and your teammates are already spreading out to run. What's the priority?",
    opts: ["Hold the ball to let everyone reset first", "Distribute fast before the other team can get organized again", "Punt it out of bounds"],
    a: 1, why: "Right after a save on a set piece, the opponent is often still crowded near your goal \u2014 a fast release can catch them out." },

  // Left Defender — expanded
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Center Defender"],
    q: "The ball is on the far right side of the field. Where do you go?",
    opts: ["Stay wide on the left touchline", "Tuck in close to the Center Defender", "Push up to join the attack"],
    a: 1, why: "When the ball is far away, tucking in keeps the back line tight with no gaps to exploit." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Left Midfielder"],
    q: "Your Left Midfielder drops deep to help build. What do you do?",
    opts: ["Stay exactly where you are", "Push up slightly to give her an easy passing option", "Swap positions with her completely"],
    a: 1, why: "Staying connected means adjusting your spacing as your teammates move, not staying frozen in one spot." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Center Defender", "Right Defender"],
    q: "Our back three shifts right as the ball moves that way. What do you do?",
    opts: ["Hold your position on the left no matter what", "Shift across with them to keep the line even", "Drop deeper than the rest of the line"],
    a: 1, why: "A back line moves together like a rope \u2014 if you don't shift too, a gap opens right where you're standing." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender"],
    q: "An opponent winger is standing wide, but the ball is on the other side of the field. What's your positioning?",
    opts: ["Mark her tight the whole time regardless of the ball", "Stay compact centrally, ready to react if the ball switches", "Push all the way up to the halfway line"],
    a: 1, why: "You don't chase a player who isn't in the play yet \u2014 staying compact protects the team until the ball comes your way." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Defensive Midfielder"],
    q: "Your Defensive Midfielder gets bypassed by a pass through the middle. What's your job?",
    opts: ["Ignore it, that's not your zone", "Tuck in to cover the middle until she recovers", "Sprint forward to the other end"],
    a: 1, why: "When central cover is missing, the nearest defender tucks in to fill the gap temporarily." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender"],
    q: "Your team just won a corner kick. Where should you be positioned?",
    opts: ["Forward with everyone else, no matter what", "Back near the edge of the box in case of a fast counter", "On the far touchline, uninvolved"],
    a: 1, why: "Someone has to stay back for balance on a corner \u2014 being the one who guards against the counter keeps the team connected." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender", "Center Defender"],
    q: "The Center Defender steps forward to close down an attacker. What do you do?",
    opts: ["Stay wide and do nothing", "Shift over to cover the space she left in the middle", "Push all the way forward"],
    a: 1, why: "Whenever a center back steps out, the nearest defender shifts to cover the hole \u2014 that's what keeps the line connected." },
  { pos: "Left Defender", pr: "Stay Connected", hi: ["Left Defender"],
    q: "It's late in the game and your team is defending a narrow lead. How tight should your shape be?",
    opts: ["Loose and spread out", "Tighter and more compact than usual", "Doesn't matter, play the same"],
    a: 1, why: "Protecting a lead means less risk-taking and more discipline in shape \u2014 staying connected matters even more." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender", "Left Midfielder"],
    q: "Your Left Midfielder gets dribbled past near the touchline. What's your move?",
    opts: ["Wait for her to recover on her own", "Step up to press while a teammate covers behind you", "Drop off and give the attacker space"],
    a: 1, why: "Winning it back together means the next defender steps up immediately \u2014 but only with cover behind." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender"],
    q: "You lose a 1v1 duel just inside your own half. What's the team response?",
    opts: ["Nobody reacts, it's your problem alone", "The nearest teammates immediately close down to help recover", "Everyone drops all the way back"],
    a: 1, why: "The instant the ball is lost, the whole team's job is to swarm and win it back together, not leave one player exposed." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender", "Center Defender"],
    q: "An attacker beats you on the outside. Who tracks her now?",
    opts: ["Nobody \u2014 chase her yourself no matter what", "The Center Defender shifts to cover while you recover", "The Goalkeeper handles it alone"],
    a: 1, why: "When you get beaten, a covering teammate steps in \u2014 that's teamwork, not a solo fix." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender"],
    q: "You and a teammate both go to press the same attacker, leaving a gap. What should have happened?",
    opts: ["Both press \u2014 more pressure is always better", "One presses, the other covers the space", "Neither presses, just wait"],
    a: 1, why: "Pressing together doesn't mean pressing the same player \u2014 it means one presses while another covers." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender", "Left Midfielder"],
    q: "The ball is loose after a bad touch by an opponent near your side. What's the priority?",
    opts: ["Wait to see who reacts first", "Whoever's closest sprints to win it immediately", "Stand off and let it roll out"],
    a: 1, why: "A loose ball rewards whoever reacts fastest \u2014 closest player attacks it right away." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender"],
    q: "Your team just got dribbled past in midfield. What's your job as the ball carrier approaches your zone?",
    opts: ["Back off and give her room", "Show her toward the touchline where you have help", "Let her run straight down the middle"],
    a: 1, why: "Steering an attacker into a crowded area \u2014 like the sideline \u2014 makes it easier to win the ball back as a group." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender", "Center Defender"],
    q: "You press an attacker and she plays a quick pass past you. Whose job is it to react?",
    opts: ["Nobody, the ball is already gone", "The next defender steps up immediately to deny the follow-up", "Wait for a stoppage in play"],
    a: 1, why: "Winning it back together means reacting instantly to the next pass, not just to the one you missed." },
  { pos: "Left Defender", pr: "Win It Back Together", hi: ["Left Defender"],
    q: "An opponent is turning with the ball right in front of you. What's the smart challenge?",
    opts: ["Dive in with a big lunge immediately", "Stay on your feet, delay her, and wait for support", "Back off completely and do nothing"],
    a: 1, why: "Staying on your feet buys time for a teammate to arrive and win the ball together, instead of risking a foul alone." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender", "Goalkeeper"],
    q: "The Goalkeeper rolls you the ball with a defender jogging toward you. What's calm?",
    opts: ["Panic and hoof it away", "Take a touch to create an angle and look for an option", "Dribble straight into the defender"],
    a: 1, why: "A calm first touch away from pressure buys time to find the best next pass." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender", "Left Midfielder"],
    q: "You receive the ball facing your own goal with light pressure behind you. What's smart?",
    opts: ["Turn blind and hope for the best", "Check your shoulder first, then decide whether to turn or lay it off", "Panic and clear it out of bounds"],
    a: 1, why: "Scanning before you receive \u2014 or right after \u2014 tells you whether it's safe to turn or better to play simple." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender"],
    q: "Nobody is pressing you and you have the ball in space. What's the calm approach?",
    opts: ["Rush a long ball forward anyway", "Take a touch, look up, and pick the best pass available", "Dribble aimlessly to kill time"],
    a: 1, why: "No pressure is exactly when to slow down and make the smartest choice, not the fastest one." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender", "Center Defender"],
    q: "Your Center Defender is under a bit of pressure and looks to you for an outlet. What now?",
    opts: ["Stand still and hope she figures it out", "Show for the ball at an angle she can actually pass to", "Run far away to be 'safe'"],
    a: 1, why: "Being a good outlet means showing at the right angle \u2014 not just being technically nearby." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender"],
    q: "You're dribbling up the line and an opponent jockeys in front of you, in no rush to tackle. What's calm?",
    opts: ["Force a risky move immediately", "Slow down, protect the ball, and look for a supporting pass", "Panic and kick it out of bounds"],
    a: 1, why: "A patient opponent doesn't require a rushed decision \u2014 protect the ball and let a passing option appear." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender", "Defensive Midfielder"],
    q: "You have two options: a risky forward pass or a safe sideways one. Light pressure is on you. What's calm?",
    opts: ["Always force the risky pass", "Take the safe option and keep possession moving", "Panic and boot it forward blindly"],
    a: 1, why: "Calm play means reading the pressure correctly \u2014 when it's not a clear opportunity, keeping the ball matters more than forcing it." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender"],
    q: "You control a bouncing ball under mild pressure. What's your first touch priority?",
    opts: ["Just react without thinking", "Take a touch that moves the ball away from the pressure", "Try to control it perfectly still"],
    a: 1, why: "A good first touch does two jobs at once: controls the ball AND creates a bit of space from the defender." },
  { pos: "Left Defender", pr: "Play Out Calmly", hi: ["Left Defender", "Left Midfielder"],
    q: "Your Left Midfielder is calling for the ball but is actually covered. What's the calm choice?",
    opts: ["Force it to her anyway since she's calling", "Look for a better, actually open option", "Panic and clear it"],
    a: 1, why: "A calm player reads the field, not just the loudest call \u2014 sometimes the best option isn't the one asking for it." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender", "Left Midfielder"],
    q: "You win the ball and the Left Midfielder is already sprinting into open space ahead. What's the play?",
    opts: ["Slow down and wait for everyone to catch up", "Play it to her feet or into her run right away", "Dribble backward to be safe"],
    a: 1, why: "That open space closes fast \u2014 get her the ball while the gap is still there." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender"],
    q: "You intercept a pass with the other team's midfield caught upfield. What's smart?",
    opts: ["Take your time dribbling out", "Move the ball forward quickly before they can recover shape", "Pass it straight back to your goalkeeper"],
    a: 1, why: "A team caught out of position is a short-lived opportunity \u2014 quick forward play punishes it." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender", "Center Defender"],
    q: "Your Center Defender wins a tackle and there's a big gap up the middle. What's your job?",
    opts: ["Stay back just in case", "Make a forward run to give her another option", "Wait for her to dribble the whole way herself"],
    a: 1, why: "Supporting a fast break means making runs too, not leaving one player to do it alone." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender"],
    q: "Your team wins a throw-in deep in the other team's half after a turnover. What's the mindset?",
    opts: ["Slow it right down and reset completely", "Take it quickly while their defense is still scrambled", "Throw it backward to be safe"],
    a: 1, why: "A quick throw-in can catch a defense before it organizes \u2014 hesitating gives that advantage away." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender", "Striker"],
    q: "You clear a dangerous ball and see the Striker already turning to run in behind. What's the pass?",
    opts: ["A slow ball to her feet", "A quick, well-weighted ball into the space ahead of her", "Hold it and wait"],
    a: 1, why: "Playing it into her run \u2014 not to her feet \u2014 is what actually attacks the open gap." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender"],
    q: "You win a 50-50 ball just past the halfway line with open space ahead. What's the choice?",
    opts: ["Play it safe backward immediately", "Drive forward into the space before it closes", "Stop and wait for instructions"],
    a: 1, why: "Winning the ball in open space is exactly the moment to attack forward, not retreat." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender", "Left Midfielder"],
    q: "A give-and-go opens a gap down your side. What's the quick decision?",
    opts: ["Take an extra unnecessary touch", "Play the one-touch pass to keep the move flowing", "Dribble instead of passing"],
    a: 1, why: "Quick combination play only works if the passes stay quick \u2014 an extra touch can let the gap close." },
  { pos: "Left Defender", pr: "Attack the Gap Fast", hi: ["Left Defender"],
    q: "Right after your team wins the ball back, what's the very first look you should take?",
    opts: ["Slow everything down automatically", "Check for open space to attack before the other team resets", "Pass sideways no matter what"],
    a: 1, why: "The first few seconds after winning the ball are when gaps are most open \u2014 that's the moment to look forward." },

  // Center Defender — expanded
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender", "Left Defender", "Right Defender"],
    q: "The ball is on the far side of the field, away from your zone. Where do you stand?",
    opts: ["Right on the goal line", "In the middle of the back line, ready to shift either way", "Pushed all the way up to midfield"],
    a: 1, why: "Staying central and ready lets you shift to either side the instant the ball moves." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender"],
    q: "An opponent striker drifts into the gap between you and the Left Defender. What do you do?",
    opts: ["Ignore her, she's not directly on you", "Shift slightly to close that gap before it's exploited", "Chase her all the way to the sideline"],
    a: 1, why: "Closing gaps before they're used is what staying connected really means \u2014 not waiting until it's a problem." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender", "Defensive Midfielder"],
    q: "Your Defensive Midfielder gets pulled out of position. What's your job?",
    opts: ["Nothing, that's her zone", "Cover the space centrally until she recovers", "Push all the way forward instead"],
    a: 1, why: "When the shield in front of you moves, someone has to cover the middle \u2014 that's you." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender", "Right Defender"],
    q: "Our back line pushes up together after winning possession. What do you do?",
    opts: ["Stay deep just in case", "Step up together with the rest of the line", "Sprint into the attack alone"],
    a: 1, why: "A back line that moves as one unit keeps the whole team compact \u2014 stepping up together is the point." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender"],
    q: "The other team switches the ball quickly from one side to the other. What's your reaction?",
    opts: ["Stay where you were", "Shift across with the rest of the line to the new side", "Chase the ball all the way to the touchline"],
    a: 1, why: "A switch of play means the whole line shifts together \u2014 staying still leaves a gap on the new ball side." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender", "Goalkeeper"],
    q: "There's a long ball coming in behind your defense. What's your priority?",
    opts: ["Watch and hope the Goalkeeper handles it", "Communicate with her about who's covering it", "Run forward to avoid the play"],
    a: 1, why: "A clear, early conversation between defender and keeper prevents both of you leaving the same gap uncovered." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender"],
    q: "Your team is defending a corner kick. Where should you be?",
    opts: ["Wherever feels comfortable", "In your assigned zone, marking tight", "Standing outside the box the whole time"],
    a: 1, why: "Set-piece organization only works if everyone stays in their assigned connected spot." },
  { pos: "Center Defender", pr: "Stay Connected", hi: ["Center Defender", "Left Defender"],
    q: "An attacker makes a run in the channel between you and the Left Defender. Who covers it?",
    opts: ["Nobody, it's in between so it's not anyone's job", "Whichever of you is closer, with the other shifting to cover", "The Goalkeeper handles all channel runs"],
    a: 1, why: "Gaps 'in between' two defenders are exactly where staying connected and communicating matters most." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender"],
    q: "An attacker beats the Defensive Midfielder and is running straight at you. What's the plan?",
    opts: ["Dive in immediately for a tackle", "Delay her, stay on your feet, and wait for cover to arrive", "Back off and do nothing"],
    a: 1, why: "Slowing an attacker down without diving in gives your teammates time to recover and help win it back." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender", "Right Defender"],
    q: "You step up to intercept a pass. What does the Right Defender do?",
    opts: ["Also steps up to the same spot", "Shifts to cover the space you left behind", "Stays exactly where she was"],
    a: 1, why: "When one center back steps up, the partner covers behind \u2014 that's how the pair wins it back safely." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender"],
    q: "The ball is loose in a crowd right in your zone. What's your first instinct?",
    opts: ["Wait for someone else to go first", "Attack it hard and win it for the team", "Step away to avoid contact"],
    a: 1, why: "In a 50-50 scramble, committing to win the ball is exactly what 'together' requires from whoever's closest." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender", "Defensive Midfielder"],
    q: "Your Defensive Midfielder presses the ball carrier. What's your job?",
    opts: ["Also press the same player", "Cover the space and passing lanes behind her", "Ignore it completely"],
    a: 1, why: "One presses, one covers \u2014 pressing together doesn't mean everyone piles onto the ball." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender"],
    q: "You lose your matchup and she's now running at your goal. What's the team response?",
    opts: ["Nobody helps, it's your mistake to fix", "The nearest cover defender steps across immediately", "Everyone rushes toward the ball at once"],
    a: 1, why: "A mistake by one player is fixed by the team recovering together, not by that player alone." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender", "Left Defender"],
    q: "Two attackers combine to try to split your center backs. What's the response?",
    opts: ["Both of you chase the ball at the same time", "One stays with a runner, one covers the space in between", "Neither reacts and hopes it fails"],
    a: 1, why: "Defending combination play means splitting the jobs \u2014 mark the runner, cover the gap." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender"],
    q: "You win a hard tackle right at the edge of your box. What's next?",
    opts: ["Just kick it away immediately without looking", "Get up quickly, look for support, and help start the counter", "Sit on the ball to waste time"],
    a: 1, why: "Winning the ball back is only half the job \u2014 recovering to help the team use it is the other half." },
  { pos: "Center Defender", pr: "Win It Back Together", hi: ["Center Defender", "Goalkeeper"],
    q: "A dangerous cross comes in and you're unsure who's claiming it. What do you do?",
    opts: ["Stay silent and hope it works out", "Communicate clearly and early with your Goalkeeper", "Both go for it without talking"],
    a: 1, why: "Clear, early communication is what turns two defenders into a team that wins the ball back." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender", "Goalkeeper"],
    q: "You receive a back-pass with no pressure at all. What's calm?",
    opts: ["Blast it forward without looking", "Take a touch, scan, and pick the best option", "Panic and pass it out of bounds"],
    a: 1, why: "No pressure is your chance to build calmly instead of clearing for no reason." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender"],
    q: "An attacker jogs toward you but isn't really pressuring yet. What's smart?",
    opts: ["Rush a pass immediately", "Wait, then release the ball at the right moment", "Panic and dribble away randomly"],
    a: 1, why: "Reading real pressure versus a jog lets you stay patient until the right passing option opens." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender", "Defensive Midfielder"],
    q: "You have the ball and your Defensive Midfielder is showing for it under a bit of pressure. What's calm?",
    opts: ["Force it to her anyway", "Check if a safer option is open first", "Kick it out of bounds"],
    a: 1, why: "Calm doesn't always mean passing forward \u2014 sometimes it means recognizing when an option isn't actually safe." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender"],
    q: "You're dribbling out from the back and a defender jockeys in front of you. What's patient?",
    opts: ["Force a risky pass through her", "Shift the ball to the side and look for a new angle", "Panic and kick it long"],
    a: 1, why: "Shifting the ball and creating a new angle is often calmer and smarter than forcing through pressure." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender", "Left Defender"],
    q: "You receive the ball under light pressure with the Left Defender open wide. What's calm?",
    opts: ["Ignore her and dribble forward alone", "Play the simple pass and keep possession moving", "Boot it long to relieve pressure"],
    a: 1, why: "The simple, calm pass often does more for the team than a forced, flashy one." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender"],
    q: "The referee signals advantage after a foul on you, and you still have the ball. What's your mindset?",
    opts: ["Stop and appeal to the ref", "Stay calm, keep playing, and make the smart decision", "Panic and kick it away"],
    a: 1, why: "Staying composed even when frustrated is part of playing calmly under real match pressure." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender", "Right Defender"],
    q: "You're deciding between two calm passing options under mild pressure. How do you choose?",
    opts: ["Always pick the furthest option", "Pick whichever gives your team the most time and space", "Pick randomly"],
    a: 1, why: "Calm decision-making means weighing which option actually helps your team keep control." },
  { pos: "Center Defender", pr: "Play Out Calmly", hi: ["Center Defender"],
    q: "You control a difficult bouncing ball with a defender closing in. What's the first priority?",
    opts: ["Panic and swing at it", "A composed first touch that takes you away from pressure", "Try to stop it dead under your foot"],
    a: 1, why: "A calm first touch under pressure is often the hardest and most valuable skill a defender has." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender", "Striker"],
    q: "You win the ball and the Striker is already sprinting into a gap ahead. What's the move?",
    opts: ["Slow it down and wait for everyone", "Play it into her run right away", "Dribble it yourself the whole way"],
    a: 1, why: "A run into open space only pays off if the pass arrives while the gap still exists." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender"],
    q: "You intercept a pass and the other team's midfield is caught upfield. What's smart?",
    opts: ["Take extra touches to be careful", "Move it forward quickly before they can recover", "Play it straight back to your goalkeeper"],
    a: 1, why: "A caught-out midfield is a short window \u2014 quick decisions punish it before it closes." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender", "Center Midfielder"],
    q: "You win a header and knock it down to open space. What happens next?",
    opts: ["Everyone stands still and admires it", "Your Center Midfielder drives forward into the space immediately", "The ball just sits there unclaimed"],
    a: 1, why: "Winning the first ball is only useful if someone attacks the second ball into space right away." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender"],
    q: "Your team wins a free kick just past midfield with the other defense still scrambling. What's the mindset?",
    opts: ["Take your time setting it up", "Take it quickly while they're disorganized", "Play it backward to reset"],
    a: 1, why: "A quick restart can catch a defense that hasn't recovered its shape yet." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender", "Defensive Midfielder"],
    q: "You win the ball in a tackle and your Defensive Midfielder calls for a quick pass forward. What do you do?",
    opts: ["Ignore the call and dribble slowly", "Play it to her quickly to keep the fast break going", "Pass it sideways instead"],
    a: 1, why: "Keeping a fast break moving means trusting the quick option, not slowing it down." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender"],
    q: "You clear a ball and it lands at your own feet again with space ahead. What's the choice?",
    opts: ["Boot it away immediately out of habit", "Carry it forward into the open space", "Stop and wait for a teammate to take over"],
    a: 1, why: "Sometimes the fastest way to attack a gap is to just carry the ball yourself instead of clearing on reflex." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender", "Left Midfielder"],
    q: "After winning the ball, you spot the Left Midfielder making a run down the line. What's the pass?",
    opts: ["A slow ball to her feet", "A firm, well-timed ball into the space ahead of her", "Hold the ball and wait"],
    a: 1, why: "Playing into the run \u2014 ahead of her \u2014 is what actually exploits the open gap." },
  { pos: "Center Defender", pr: "Attack the Gap Fast", hi: ["Center Defender"],
    q: "Right after your team regains possession, what's the very first thing you should look for?",
    opts: ["An automatic safe pass sideways", "Any open space to attack before the other team resets", "Nothing \u2014 just hold the ball"],
    a: 1, why: "The moments right after winning the ball are when the biggest gaps exist \u2014 that's the time to look forward." },

  // Right Defender — expanded
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Center Defender"],
    q: "The ball is over on the far left side of the field. Where do you go?",
    opts: ["Stay wide on the right touchline", "Tuck in close to the Center Defender", "Push up to join the attack"],
    a: 1, why: "When the ball is far away, tucking in keeps the back line tight with no gaps to exploit." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Right Midfielder"],
    q: "Your Right Midfielder drops deep to help build. What do you do?",
    opts: ["Stay exactly where you are", "Push up slightly to give her an easy passing option", "Swap positions with her completely"],
    a: 1, why: "Staying connected means adjusting your spacing as your teammates move, not staying frozen in one spot." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Center Defender", "Left Defender"],
    q: "Our back three shifts left as the ball moves that way. What do you do?",
    opts: ["Hold your position on the right no matter what", "Shift across with them to keep the line even", "Drop deeper than the rest of the line"],
    a: 1, why: "A back line moves together like a rope \u2014 if you don't shift too, a gap opens right where you're standing." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender"],
    q: "An opponent winger is standing wide, but the ball is on the other side of the field. What's your positioning?",
    opts: ["Mark her tight the whole time regardless of the ball", "Stay compact centrally, ready to react if the ball switches", "Push all the way up to the halfway line"],
    a: 1, why: "You don't chase a player who isn't in the play yet \u2014 staying compact protects the team until the ball comes your way." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Defensive Midfielder"],
    q: "Your Defensive Midfielder gets bypassed by a pass through the middle. What's your job?",
    opts: ["Ignore it, that's not your zone", "Tuck in to cover the middle until she recovers", "Sprint forward to the other end"],
    a: 1, why: "When central cover is missing, the nearest defender tucks in to fill the gap temporarily." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender"],
    q: "Your team just won a corner kick. Where should you be positioned?",
    opts: ["Forward with everyone else, no matter what", "Back near the edge of the box in case of a fast counter", "On the far touchline, uninvolved"],
    a: 1, why: "Someone has to stay back for balance on a corner \u2014 being the one who guards against the counter keeps the team connected." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender", "Center Defender"],
    q: "The Center Defender steps forward to close down an attacker. What do you do?",
    opts: ["Stay wide and do nothing", "Shift over to cover the space she left in the middle", "Push all the way forward"],
    a: 1, why: "Whenever a center back steps out, the nearest defender shifts to cover the hole \u2014 that's what keeps the line connected." },
  { pos: "Right Defender", pr: "Stay Connected", hi: ["Right Defender"],
    q: "It's late in the game and your team is defending a narrow lead. How tight should your shape be?",
    opts: ["Loose and spread out", "Tighter and more compact than usual", "Doesn't matter, play the same"],
    a: 1, why: "Protecting a lead means less risk-taking and more discipline in shape \u2014 staying connected matters even more." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender", "Right Midfielder"],
    q: "Your Right Midfielder gets dribbled past near the touchline. What's your move?",
    opts: ["Wait for her to recover on her own", "Step up to press while a teammate covers behind you", "Drop off and give the attacker space"],
    a: 1, why: "Winning it back together means the next defender steps up immediately \u2014 but only with cover behind." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender"],
    q: "You lose a 1v1 duel just inside your own half. What's the team response?",
    opts: ["Nobody reacts, it's your problem alone", "The nearest teammates immediately close down to help recover", "Everyone drops all the way back"],
    a: 1, why: "The instant the ball is lost, the whole team's job is to swarm and win it back together, not leave one player exposed." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender", "Center Defender"],
    q: "An attacker beats you on the outside. Who tracks her now?",
    opts: ["Nobody \u2014 chase her yourself no matter what", "The Center Defender shifts to cover while you recover", "The Goalkeeper handles it alone"],
    a: 1, why: "When you get beaten, a covering teammate steps in \u2014 that's teamwork, not a solo fix." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender"],
    q: "You and a teammate both go to press the same attacker, leaving a gap. What should have happened?",
    opts: ["Both press \u2014 more pressure is always better", "One presses, the other covers the space", "Neither presses, just wait"],
    a: 1, why: "Pressing together doesn't mean pressing the same player \u2014 it means one presses while another covers." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender", "Right Midfielder"],
    q: "The ball is loose after a bad touch by an opponent near your side. What's the priority?",
    opts: ["Wait to see who reacts first", "Whoever's closest sprints to win it immediately", "Stand off and let it roll out"],
    a: 1, why: "A loose ball rewards whoever reacts fastest \u2014 closest player attacks it right away." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender"],
    q: "Your team just got dribbled past in midfield. What's your job as the ball carrier approaches your zone?",
    opts: ["Back off and give her room", "Show her toward the touchline where you have help", "Let her run straight down the middle"],
    a: 1, why: "Steering an attacker into a crowded area \u2014 like the sideline \u2014 makes it easier to win the ball back as a group." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender", "Center Defender"],
    q: "You press an attacker and she plays a quick pass past you. Whose job is it to react?",
    opts: ["Nobody, the ball is already gone", "The next defender steps up immediately to deny the follow-up", "Wait for a stoppage in play"],
    a: 1, why: "Winning it back together means reacting instantly to the next pass, not just to the one you missed." },
  { pos: "Right Defender", pr: "Win It Back Together", hi: ["Right Defender"],
    q: "An opponent is turning with the ball right in front of you. What's the smart challenge?",
    opts: ["Dive in with a big lunge immediately", "Stay on your feet, delay her, and wait for support", "Back off completely and do nothing"],
    a: 1, why: "Staying on your feet buys time for a teammate to arrive and win the ball together, instead of risking a foul alone." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender", "Goalkeeper"],
    q: "The Goalkeeper rolls you the ball with a defender jogging toward you. What's calm?",
    opts: ["Panic and hoof it away", "Take a touch to create an angle and look for an option", "Dribble straight into the defender"],
    a: 1, why: "A calm first touch away from pressure buys time to find the best next pass." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender", "Right Midfielder"],
    q: "You receive the ball facing your own goal with light pressure behind you. What's smart?",
    opts: ["Turn blind and hope for the best", "Check your shoulder first, then decide whether to turn or lay it off", "Panic and clear it out of bounds"],
    a: 1, why: "Scanning before you receive \u2014 or right after \u2014 tells you whether it's safe to turn or better to play simple." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender"],
    q: "Nobody is pressing you and you have the ball in space. What's the calm approach?",
    opts: ["Rush a long ball forward anyway", "Take a touch, look up, and pick the best pass available", "Dribble aimlessly to kill time"],
    a: 1, why: "No pressure is exactly when to slow down and make the smartest choice, not the fastest one." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender", "Center Defender"],
    q: "Your Center Defender is under a bit of pressure and looks to you for an outlet. What now?",
    opts: ["Stand still and hope she figures it out", "Show for the ball at an angle she can actually pass to", "Run far away to be 'safe'"],
    a: 1, why: "Being a good outlet means showing at the right angle \u2014 not just being technically nearby." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender"],
    q: "You're dribbling up the line and an opponent jockeys in front of you, in no rush to tackle. What's calm?",
    opts: ["Force a risky move immediately", "Slow down, protect the ball, and look for a supporting pass", "Panic and kick it out of bounds"],
    a: 1, why: "A patient opponent doesn't require a rushed decision \u2014 protect the ball and let a passing option appear." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender", "Defensive Midfielder"],
    q: "You have two options: a risky forward pass or a safe sideways one. Light pressure is on you. What's calm?",
    opts: ["Always force the risky pass", "Take the safe option and keep possession moving", "Panic and boot it forward blindly"],
    a: 1, why: "Calm play means reading the pressure correctly \u2014 when it's not a clear opportunity, keeping the ball matters more than forcing it." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender"],
    q: "You control a bouncing ball under mild pressure. What's your first touch priority?",
    opts: ["Just react without thinking", "Take a touch that moves the ball away from the pressure", "Try to control it perfectly still"],
    a: 1, why: "A good first touch does two jobs at once: controls the ball AND creates a bit of space from the defender." },
  { pos: "Right Defender", pr: "Play Out Calmly", hi: ["Right Defender", "Right Midfielder"],
    q: "Your Right Midfielder is calling for the ball but is actually covered. What's the calm choice?",
    opts: ["Force it to her anyway since she's calling", "Look for a better, actually open option", "Panic and clear it"],
    a: 1, why: "A calm player reads the field, not just the loudest call \u2014 sometimes the best option isn't the one asking for it." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender", "Right Midfielder"],
    q: "You win the ball and the Right Midfielder is already sprinting into open space ahead. What's the play?",
    opts: ["Slow down and wait for everyone to catch up", "Play it to her feet or into her run right away", "Dribble backward to be safe"],
    a: 1, why: "That open space closes fast \u2014 get her the ball while the gap is still there." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender"],
    q: "You intercept a pass with the other team's midfield caught upfield. What's smart?",
    opts: ["Take your time dribbling out", "Move the ball forward quickly before they can recover shape", "Pass it straight back to your goalkeeper"],
    a: 1, why: "A team caught out of position is a short-lived opportunity \u2014 quick forward play punishes it." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender", "Center Defender"],
    q: "Your Center Defender wins a tackle and there's a big gap up the middle. What's your job?",
    opts: ["Stay back just in case", "Make a forward run to give her another option", "Wait for her to dribble the whole way herself"],
    a: 1, why: "Supporting a fast break means making runs too, not leaving one player to do it alone." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender"],
    q: "Your team wins a throw-in deep in the other team's half after a turnover. What's the mindset?",
    opts: ["Slow it right down and reset completely", "Take it quickly while their defense is still scrambled", "Throw it backward to be safe"],
    a: 1, why: "A quick throw-in can catch a defense before it organizes \u2014 hesitating gives that advantage away." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender", "Striker"],
    q: "You clear a dangerous ball and see the Striker already turning to run in behind. What's the pass?",
    opts: ["A slow ball to her feet", "A quick, well-weighted ball into the space ahead of her", "Hold it and wait"],
    a: 1, why: "Playing it into her run \u2014 not to her feet \u2014 is what actually attacks the open gap." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender"],
    q: "You win a 50-50 ball just past the halfway line with open space ahead. What's the choice?",
    opts: ["Play it safe backward immediately", "Drive forward into the space before it closes", "Stop and wait for instructions"],
    a: 1, why: "Winning the ball in open space is exactly the moment to attack forward, not retreat." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender", "Right Midfielder"],
    q: "A give-and-go opens a gap down your side. What's the quick decision?",
    opts: ["Take an extra unnecessary touch", "Play the one-touch pass to keep the move flowing", "Dribble instead of passing"],
    a: 1, why: "Quick combination play only works if the passes stay quick \u2014 an extra touch can let the gap close." },
  { pos: "Right Defender", pr: "Attack the Gap Fast", hi: ["Right Defender"],
    q: "Right after your team wins the ball back, what's the very first look you should take?",
    opts: ["Slow everything down automatically", "Check for open space to attack before the other team resets", "Pass sideways no matter what"],
    a: 1, why: "The first few seconds after winning the ball are when gaps are most open \u2014 that's the moment to look forward." },

  // Defensive Midfielder — expanded
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder", "Center Defender"],
    q: "Your Center Defender steps up to press. What's your job?",
    opts: ["Push forward too, leaving the gap behind", "Drop slightly to cover the space she left", "Stay exactly where you were"],
    a: 1, why: "As the shield in front of the back line, you cover the hole whenever a center back steps out." },
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder"],
    q: "The ball is on the far side of the field. Where should you be?",
    opts: ["Standing still in the exact center", "Shifted toward the ball side, staying compact with the back line", "Pushed all the way forward"],
    a: 1, why: "Shifting with the ball while staying between the lines keeps you connected to both the defense and midfield." },
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder", "Left Midfielder", "Right Midfielder"],
    q: "Your midfield line is spread too far apart. What fixes it?",
    opts: ["Nothing, spacing doesn't matter", "Everyone tightens in to stay connected", "Only the wide players adjust"],
    a: 1, why: "A midfield that's too stretched can be split easily \u2014 staying connected means tightening the gaps together." },
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder"],
    q: "Your team is defending deep, protecting a lead. Where do you sit?",
    opts: ["Pushed up near the halfway line", "Just in front of the back line, screening the middle", "Wherever feels comfortable"],
    a: 1, why: "Sitting just in front of the defense protects the most dangerous central space when the team needs to stay solid." },
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder", "Center Defender"],
    q: "An opponent striker drifts into the pocket between your midfield and defense. What do you do?",
    opts: ["Ignore her since she's not near the ball", "Drop in to close that pocket before it's used", "Push forward instead"],
    a: 1, why: "That pocket of space is exactly what a Defensive Midfielder exists to close." },
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder"],
    q: "Your team wins a corner kick. What's your job while it's taken?",
    opts: ["Push forward with everyone", "Stay back to guard against the counterattack", "Stand near the corner flag"],
    a: 1, why: "Someone has to stay connected to defense even during an attacking set piece \u2014 that's often you." },
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder", "Right Defender"],
    q: "The Right Defender pushes forward to overlap. What do you do?",
    opts: ["Also push forward at the same time", "Shift over slightly to cover the space she left", "Stay exactly central regardless"],
    a: 1, why: "When a fullback bombs forward, the Defensive Midfielder often covers behind \u2014 that's staying connected as a team." },
  { pos: "Defensive Midfielder", pr: "Stay Connected", hi: ["Defensive Midfielder"],
    q: "The other team switches play quickly from one side to the other. How do you react?",
    opts: ["Stay in the exact same spot", "Shift across to stay in the right central position", "Sprint to the far touchline"],
    a: 1, why: "A quick switch of play means your central position shifts too \u2014 not all the way to the ball, but enough to stay connected." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder"],
    q: "An attacker receives the ball right in front of you. What's the first move?",
    opts: ["Dive in immediately", "Close the distance and delay her, forcing a mistake", "Stand off and do nothing"],
    a: 1, why: "Delaying and pressuring without diving in is often what wins the ball back as a team, since it buys time for help." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder", "Center Midfielder"],
    q: "Your Center Midfielder presses the ball carrier high up the field. What's your job?",
    opts: ["Also chase the same ball", "Cover the space and passing lanes behind her", "Stay far away from the play"],
    a: 1, why: "While one midfielder presses, the other covers \u2014 that's what makes pressing a team effort instead of a chase." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder"],
    q: "The ball is loose in midfield after a bad touch. What's your instinct?",
    opts: ["Wait to see who goes first", "Sprint to win it before the opponent recovers", "Stay in position and do nothing"],
    a: 1, why: "A Defensive Midfielder who wins loose balls in the middle is often what starts a team's best chances." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder", "Left Defender"],
    q: "An attacker beats your Left Defender and is driving forward. What's your job?",
    opts: ["Ignore it, it's her mistake", "Step across to delay the attacker while help arrives", "Push forward instead"],
    a: 1, why: "Screening in front of the defense means cleaning up exactly these moments." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder"],
    q: "Two opponents are combining to try to play through the middle. What's the response?",
    opts: ["Chase whoever has the ball, no matter what", "Stay central to cut the passing lane between them", "Drop all the way back to the goal"],
    a: 1, why: "Sometimes winning the ball back means denying the pass, not chasing the player." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder", "Center Defender"],
    q: "You win a tackle in a dangerous area. What's next?",
    opts: ["Kick it away without looking", "Look up and find a safe way to start the attack", "Sit on the ball to waste time"],
    a: 1, why: "Winning the ball back is only the first step \u2014 using it well is what makes it count for the team." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder"],
    q: "Your team just lost the ball in the attacking third. What's your first reaction?",
    opts: ["Relax since it's far from your goal", "Start recovering into position immediately to stop a counter", "Wait until the ball crosses midfield"],
    a: 1, why: "The best defensive midfielders react to a turnover the instant it happens, not after the counter is already moving." },
  { pos: "Defensive Midfielder", pr: "Win It Back Together", hi: ["Defensive Midfielder", "Right Midfielder"],
    q: "Your Right Midfielder gets caught out of position after losing the ball. What's your job?",
    opts: ["Do nothing, it's her job to recover", "Shift over to cover the space until she gets back", "Push forward to join the attack instead"],
    a: 1, why: "Covering for a teammate who's out of position is exactly what 'together' means in defense." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder", "Center Defender"],
    q: "You receive the ball from your Center Defender under mild pressure. What's calm?",
    opts: ["Panic and boot it forward", "Take a touch away from the pressure and find an option", "Pass it straight back immediately"],
    a: 1, why: "A calm first touch away from pressure is what turns a nervous moment into a controlled one." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder"],
    q: "You're facing your own goal with a defender closing in behind you. What's smart?",
    opts: ["Try to turn blindly anyway", "Check over your shoulder first, then decide", "Panic and lose the ball trying to spin away"],
    a: 1, why: "Scanning before you receive tells you whether turning is actually safe." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder", "Left Midfielder"],
    q: "You have the ball with no real pressure on you. What's the calm approach?",
    opts: ["Rush a forward pass anyway", "Take a moment, scan the field, and pick the best option", "Dribble aimlessly"],
    a: 1, why: "No pressure is your chance to make the smartest decision, not the fastest one." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder"],
    q: "You're deciding between a risky pass through traffic and a safe sideways one. What's calm?",
    opts: ["Always force the risky one", "Choose based on what's actually open, not what looks flashy", "Panic and clear it"],
    a: 1, why: "Calm decision-making means reading the real picture, not forcing a play that isn't there." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder", "Right Defender"],
    q: "Your Right Defender is calling for the ball but is tightly marked. What do you do?",
    opts: ["Force the pass to her anyway", "Look for a better, truly open option", "Kick the ball away"],
    a: 1, why: "A calm player passes to who's actually open, not just who's asking loudest." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder"],
    q: "You control a tricky bouncing ball with an opponent closing fast. What's the priority?",
    opts: ["Panic and swing wildly", "A composed touch that takes the ball away from pressure", "Try to trap it dead under pressure"],
    a: 1, why: "A calm, controlled touch under pressure is one of the most valuable skills in the middle of the field." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder", "Center Midfielder"],
    q: "You and your Center Midfielder are both open, but she has more space. What's calm?",
    opts: ["Keep the ball yourself regardless", "Pass to her since she has more room to work", "Boot it long instead"],
    a: 1, why: "Recognizing who has more time and space \u2014 even if it's a teammate, not you \u2014 is a calm, team-first decision." },
  { pos: "Defensive Midfielder", pr: "Play Out Calmly", hi: ["Defensive Midfielder"],
    q: "It's a tense moment late in a close game and you're on the ball. Does that change your approach?",
    opts: ["Yes, always rush the decision", "No, stick to the same calm process every time", "Yes, always pass backward no matter what"],
    a: 1, why: "Composure matters most exactly when the moment feels biggest \u2014 the process shouldn't change." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder", "Striker"],
    q: "You win the ball in midfield and the Striker is already sprinting forward. What's the move?",
    opts: ["Slow down and dribble carefully", "Play it into her run right away", "Pass sideways instead"],
    a: 1, why: "A run into space only works if the pass arrives while the gap is still open." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder"],
    q: "You intercept a pass and the opponent's defense is caught upfield. What's smart?",
    opts: ["Take your time building up", "Move the ball forward quickly before they recover shape", "Play it backward to reset"],
    a: 1, why: "A defense caught out of position won't stay that way long \u2014 quick decisions punish it." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder", "Center Midfielder"],
    q: "You win the ball and your Center Midfielder calls for a quick pass forward. What do you do?",
    opts: ["Ignore the call and slow it down", "Play it to her quickly to keep the break moving", "Pass backward instead"],
    a: 1, why: "Keeping a fast break alive means trusting the quick option in the moment." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder"],
    q: "Your team wins a free kick just past midfield with the other team's defense scrambling. What's the mindset?",
    opts: ["Take your time setting it up", "Take it quickly while they're still disorganized", "Play it backward to reset"],
    a: 1, why: "A quick restart can catch a defense before it gets back into shape." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder", "Left Midfielder"],
    q: "After winning the ball, your Left Midfielder is already making a run into space. What's the pass?",
    opts: ["A slow ball to her feet", "A firm, well-timed ball into the space ahead of her", "Hold the ball and wait"],
    a: 1, why: "Playing into the run \u2014 ahead of her \u2014 is what actually attacks the gap." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder"],
    q: "You win a tackle with a big open gap in front of you. What's the choice?",
    opts: ["Always pass backward out of habit", "Drive forward into the space yourself", "Stop and wait for instructions"],
    a: 1, why: "Sometimes the fastest way to attack a gap is to carry the ball forward yourself." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder", "Right Midfielder"],
    q: "A quick one-two opens space down the right side. What's the decision?",
    opts: ["Take an extra unnecessary touch", "Keep it one-touch to keep the move flowing", "Dribble instead of passing"],
    a: 1, why: "Fast combination play only works if the passes stay quick \u2014 hesitation lets the gap close." },
  { pos: "Defensive Midfielder", pr: "Attack the Gap Fast", hi: ["Defensive Midfielder"],
    q: "The instant your team regains possession, what's the first thing you look for?",
    opts: ["An automatic pass sideways", "Any open space to attack before the other team resets", "Nothing \u2014 hold the ball and wait"],
    a: 1, why: "The moments right after winning the ball are when the biggest gaps exist." },

  // Left Midfielder — expanded
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder", "Left Defender"],
    q: "The ball is on the far right side of the field. Where do you go?",
    opts: ["Stay pinned wide on the left", "Tuck in centrally to stay compact with the team", "Sprint to the right side immediately"],
    a: 1, why: "When the ball is far away, tucking in keeps the midfield line connected and hard to play through." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder", "Defensive Midfielder"],
    q: "Your Defensive Midfielder is under pressure with no easy outlet. What do you do?",
    opts: ["Stay wide and wait", "Drift inside to offer a passing option", "Push all the way forward"],
    a: 1, why: "Staying connected sometimes means giving up your normal spot to support a teammate under pressure." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder", "Left Defender"],
    q: "Your Left Defender pushes forward to overlap you. What's your job?",
    opts: ["Also push forward at the same time, leaving no width", "Tuck slightly inside to balance the width", "Stay exactly where you were"],
    a: 1, why: "When your fullback overlaps, shifting inside keeps the team's shape balanced instead of both of you being on the line." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder"],
    q: "Your team is defending deep in your own half. Where should you be?",
    opts: ["Staying high up the field", "Tracking back to help make the defense compact", "Standing near the corner flag"],
    a: 1, why: "Staying connected on defense means tracking back, not staying forward waiting for a counterattack." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder", "Center Midfielder"],
    q: "The midfield line is spread too far apart horizontally. What fixes it?",
    opts: ["Nothing changes", "Everyone tightens the spacing together", "Only you adjust, nobody else"],
    a: 1, why: "A stretched midfield line is easy to play through \u2014 staying connected means everyone tightening up together." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder"],
    q: "Your team just won the ball back deep in your own half. Where should you position yourself?",
    opts: ["Stay exactly where you were, far forward", "Move into a supporting passing lane nearby", "Sprint to the other team's goal immediately"],
    a: 1, why: "Right after winning the ball, staying connected and available for a pass matters more than sprinting forward alone." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder", "Striker"],
    q: "The Striker drops deep looking for support. What do you do?",
    opts: ["Ignore her and stay wide", "Provide an option so she's not isolated", "Push even higher up the field"],
    a: 1, why: "Staying connected to your attacking teammates means being available, not leaving them isolated." },
  { pos: "Left Midfielder", pr: "Stay Connected", hi: ["Left Midfielder"],
    q: "Your team is protecting a lead late in the game. How aggressive should your positioning be?",
    opts: ["Very aggressive, push forward constantly", "More disciplined and compact than usual", "No different than any other moment"],
    a: 1, why: "Protecting a lead calls for extra discipline in shape \u2014 staying connected matters even more." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder", "Left Defender"],
    q: "An attacker beats your Left Defender near the touchline. What's your job?",
    opts: ["Ignore it, that's her zone", "Track back to help win the ball as a pair", "Push forward instead"],
    a: 1, why: "Winning it back together means tracking back to help, not leaving your defender alone." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder"],
    q: "You lose the ball in midfield right after receiving a pass. What's the team reaction?",
    opts: ["Nobody reacts, it's your mistake", "The closest teammates immediately press to win it back", "Everyone drops deep instead"],
    a: 1, why: "The instant the ball is lost, the whole team's job is to counter-press together." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder", "Defensive Midfielder"],
    q: "Your Defensive Midfielder presses the ball carrier. What's your job?",
    opts: ["Also chase the same ball", "Cut off a nearby passing lane", "Stand still and watch"],
    a: 1, why: "Pressing together means covering different options, not everyone chasing the ball at once." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder"],
    q: "The ball is loose after a bad touch near your zone. What's the priority?",
    opts: ["Wait to see who reacts first", "Sprint to win it immediately", "Stand off and let it roll out"],
    a: 1, why: "Whoever is closest to a loose ball should attack it right away." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder", "Left Defender"],
    q: "An attacker is dribbling at both you and your Left Defender. What's the plan?",
    opts: ["Both challenge at the same time", "One delays while the other angles to cut off her options", "Neither engages"],
    a: 1, why: "Two defenders working together \u2014 one delaying, one covering \u2014 is stronger than both diving in." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder"],
    q: "Your team just got dribbled past in midfield. What's your job as the play develops?",
    opts: ["Stand still and watch", "Recover quickly to help outnumber the attacker", "Push forward instead"],
    a: 1, why: "Recovering to help win the ball back together is exactly what winning it back as a team looks like." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder", "Center Midfielder"],
    q: "Your Center Midfielder wins a tackle but is under pressure immediately. What's your job?",
    opts: ["Ignore her and stay wide", "Move to give her a quick, safe passing option", "Push all the way forward"],
    a: 1, why: "Supporting a teammate right after she wins the ball is part of winning it back together \u2014 securing it, not just recovering it." },
  { pos: "Left Midfielder", pr: "Win It Back Together", hi: ["Left Midfielder"],
    q: "An opponent turns with the ball right in front of you. What's the smart challenge?",
    opts: ["Dive in immediately", "Stay on your feet and delay while help arrives", "Back off completely"],
    a: 1, why: "Staying on your feet buys time for a teammate to arrive and help win the ball together." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder", "Left Defender"],
    q: "You receive the ball from your Left Defender under light pressure. What's calm?",
    opts: ["Panic and boot it forward", "Take a touch away from pressure and look for an option", "Pass it straight back immediately"],
    a: 1, why: "A calm first touch away from pressure buys time to find the smartest next pass." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder"],
    q: "You're facing your own goal with an opponent closing in behind you. What's smart?",
    opts: ["Try to spin and turn blindly", "Check your shoulder first, then decide whether to turn or lay it off", "Panic and force a pass"],
    a: 1, why: "Scanning before or right as you receive tells you whether it's actually safe to turn." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder", "Defensive Midfielder"],
    q: "You have the ball and no real pressure. What's the calm approach?",
    opts: ["Rush a risky pass anyway", "Take a moment, scan, and pick the smartest option", "Dribble aimlessly to burn time"],
    a: 1, why: "No pressure means no rush \u2014 this is when to make the smartest choice, not the fastest." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder"],
    q: "You're deciding between a risky pass through traffic or a simple one sideways. What's calm?",
    opts: ["Always force the risky one", "Choose based on what's actually open", "Panic and clear it"],
    a: 1, why: "Calm decision-making reads the real picture instead of forcing a play that isn't really there." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder", "Striker"],
    q: "The Striker is calling for the ball but is tightly marked. What do you do?",
    opts: ["Force the pass to her anyway", "Look for a better, truly open option", "Boot the ball away instead"],
    a: 1, why: "A calm player passes to whoever's actually open, not just whoever's loudest." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder"],
    q: "You control a difficult ball with a defender closing in fast. What's the priority?",
    opts: ["Panic and swing at it", "A composed touch that creates space from the pressure", "Try to stop it dead under pressure"],
    a: 1, why: "A calm first touch under pressure is one of the most valuable skills in midfield." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder", "Center Midfielder"],
    q: "You and your Center Midfielder are both open, but she has more time on the ball. What's calm?",
    opts: ["Keep it yourself regardless", "Pass to her since she has more space to work", "Boot it long instead"],
    a: 1, why: "Recognizing who has more time \u2014 even if it's a teammate \u2014 is a calm, team-first read." },
  { pos: "Left Midfielder", pr: "Play Out Calmly", hi: ["Left Midfielder"],
    q: "It's a tense, close moment in the game and you're on the ball. Does that change your approach?",
    opts: ["Yes, rush the decision", "No, stick to the same calm process every time", "Yes, always pass backward"],
    a: 1, why: "Composure matters most exactly when the moment feels biggest." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder", "Striker"],
    q: "You win the ball and the Striker is already sprinting into a gap ahead. What's the move?",
    opts: ["Slow down and dribble carefully", "Play it into her run right away", "Pass sideways instead"],
    a: 1, why: "That run into space only works if the pass arrives while the gap is still open." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder"],
    q: "You intercept a pass with the other team's defense caught upfield. What's smart?",
    opts: ["Take your time building up", "Move the ball forward quickly before they recover shape", "Play it backward to reset"],
    a: 1, why: "A defense caught out of position won't stay that way long \u2014 quick decisions punish it." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder", "Center Midfielder"],
    q: "Your Center Midfielder wins the ball and there's a big gap ahead. What's your job?",
    opts: ["Stay back just in case", "Make a forward run to give her an option", "Wait for her to dribble it herself"],
    a: 1, why: "Supporting a fast break means making runs too, not leaving one player to do it alone." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder"],
    q: "Your team wins a throw-in high up the field after a turnover. What's the mindset?",
    opts: ["Slow it right down and reset", "Take it quickly while their defense is scrambled", "Throw it backward to be safe"],
    a: 1, why: "A quick throw-in can catch a defense before it organizes." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder", "Left Defender"],
    q: "A give-and-go with your Left Defender opens a gap down the line. What's the decision?",
    opts: ["Take an extra unnecessary touch", "Keep it one-touch to keep the move flowing", "Dribble instead of passing"],
    a: 1, why: "Quick combination play only works if the passes stay quick." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder"],
    q: "You win a 50-50 ball with open space ahead of you. What's the choice?",
    opts: ["Play it safe backward immediately", "Drive forward into the space before it closes", "Stop and wait for instructions"],
    a: 1, why: "Winning the ball in open space is exactly the moment to attack forward." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder", "Striker"],
    q: "You clear a dangerous moment and see the Striker turning to run in behind. What's the pass?",
    opts: ["A slow ball to her feet", "A quick, well-weighted ball into the space ahead of her", "Hold it and wait"],
    a: 1, why: "Playing it into her run \u2014 not to her feet \u2014 is what actually attacks the open gap." },
  { pos: "Left Midfielder", pr: "Attack the Gap Fast", hi: ["Left Midfielder"],
    q: "The instant your team wins the ball back, what's your first read?",
    opts: ["An automatic pass sideways", "Any open space to attack before the other team resets", "Nothing \u2014 hold the ball"],
    a: 1, why: "The moments right after winning the ball are when the biggest gaps exist." },

  // Center Midfielder — expanded
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder", "Defensive Midfielder"],
    q: "Your Defensive Midfielder pushes up to press. What's your job?",
    opts: ["Push forward too, leaving a gap behind", "Drop slightly to cover the space she left", "Stay exactly where you were"],
    a: 1, why: "As the link between defense and attack, you cover the middle whenever the DM steps out." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder"],
    q: "The ball is on the far side of the field. Where should you be?",
    opts: ["Standing still on the opposite side", "Shifted toward the ball side, staying central", "Pushed all the way forward"],
    a: 1, why: "Shifting with the ball while staying central keeps you connected to the whole team." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder", "Left Midfielder", "Right Midfielder"],
    q: "Your midfield line is spread too far apart. What fixes it?",
    opts: ["Nothing, spacing doesn't matter", "Everyone tightens in together", "Only the wide players adjust"],
    a: 1, why: "A stretched midfield is easy to play through \u2014 staying connected means tightening the gaps as a group." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder"],
    q: "Your team is defending deep, protecting a lead. Where do you sit?",
    opts: ["Pushed up near the halfway line", "Just in front of the back line, screening the middle", "Wherever feels comfortable"],
    a: 1, why: "Sitting deeper and central protects the most dangerous space when the team needs to stay solid." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder", "Striker"],
    q: "The Striker drops deep looking for support. What do you do?",
    opts: ["Ignore her and hold your line", "Move to provide an option nearby", "Push even higher up the field"],
    a: 1, why: "Staying connected to your attacking teammates means being available, not leaving them isolated." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder"],
    q: "Your team wins a corner kick. What's your job while it's taken?",
    opts: ["Push forward with everyone", "Stay back to guard against the counterattack", "Stand near the corner flag"],
    a: 1, why: "Someone has to stay connected to defense even during an attacking set piece \u2014 that's often you." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder", "Right Midfielder"],
    q: "The Right Midfielder pushes forward to attack. What do you do?",
    opts: ["Also push forward at the same time", "Shift over slightly to cover the space she left", "Stay exactly central regardless"],
    a: 1, why: "Balancing the team's shape means someone covers when a teammate commits forward." },
  { pos: "Center Midfielder", pr: "Stay Connected", hi: ["Center Midfielder"],
    q: "The other team switches play quickly from one side to the other. How do you react?",
    opts: ["Stay in the exact same spot", "Shift across to stay in the right central position", "Sprint to the far touchline"],
    a: 1, why: "A quick switch of play means your position shifts too \u2014 staying connected to the ball side matters." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder", "Defensive Midfielder"],
    q: "Your Defensive Midfielder presses the ball carrier. What's your job?",
    opts: ["Also chase the same ball", "Cover a nearby passing lane", "Stand still and watch"],
    a: 1, why: "Pressing together means covering different options, not everyone chasing the ball at once." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder"],
    q: "You lose the ball right after receiving a pass in midfield. What's the team reaction?",
    opts: ["Nobody reacts, it's your mistake", "The closest teammates immediately press to win it back", "Everyone drops deep instead"],
    a: 1, why: "The instant the ball is lost, the whole team's job is to counter-press together." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder", "Left Midfielder"],
    q: "An attacker beats your Left Midfielder in midfield. What's your job?",
    opts: ["Ignore it, that's her zone", "Step across to help win the ball back", "Push forward instead"],
    a: 1, why: "Winning it back together means the nearest teammate helps immediately." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder"],
    q: "The ball is loose in the middle of the field after a bad touch. What's your instinct?",
    opts: ["Wait to see who reacts first", "Sprint to win it before the opponent recovers", "Stay in position and do nothing"],
    a: 1, why: "A central midfielder who wins loose balls often starts a team's best chances." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder", "Right Midfielder"],
    q: "Two opponents combine to try to play through the middle. What's the response?",
    opts: ["Chase whoever has the ball, no matter what", "Stay central to cut the passing lane between them", "Drop all the way back"],
    a: 1, why: "Sometimes winning the ball back means denying the pass, not chasing the player." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder"],
    q: "You win a tackle in the middle of the field. What's next?",
    opts: ["Kick it away without looking", "Look up and find a safe way to start the attack", "Sit on the ball to waste time"],
    a: 1, why: "Winning the ball back is only the first step \u2014 using it well is what makes it count." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder", "Striker"],
    q: "Your Striker loses the ball trying to hold it up. What's your job?",
    opts: ["Ignore it, it's her mistake", "Move quickly to help win it back around her", "Stay far away"],
    a: 1, why: "Supporting a teammate who loses the ball is exactly what winning it back together looks like." },
  { pos: "Center Midfielder", pr: "Win It Back Together", hi: ["Center Midfielder"],
    q: "Your team just lost the ball in the attacking third. What's your first reaction?",
    opts: ["Relax since it's far from your goal", "Start recovering into position immediately to stop a counter", "Wait until the ball crosses midfield"],
    a: 1, why: "Reacting the instant a turnover happens is what stops a counterattack before it builds." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder", "Defensive Midfielder"],
    q: "You receive the ball from your Defensive Midfielder under mild pressure. What's calm?",
    opts: ["Panic and boot it forward", "Take a touch away from the pressure and find an option", "Pass it straight back immediately"],
    a: 1, why: "A calm first touch away from pressure turns a nervous moment into a controlled one." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder"],
    q: "You're facing your own goal with a defender closing in behind you. What's smart?",
    opts: ["Try to turn blindly anyway", "Check over your shoulder first, then decide", "Panic and force a risky pass"],
    a: 1, why: "Scanning before you receive tells you whether turning is actually safe." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder", "Left Midfielder"],
    q: "You have the ball with no real pressure on you. What's the calm approach?",
    opts: ["Rush a forward pass anyway", "Take a moment, scan the field, and pick the best option", "Dribble aimlessly"],
    a: 1, why: "No pressure is your chance to make the smartest decision, not the fastest one." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder"],
    q: "You're deciding between a risky pass through traffic and a safe sideways one. What's calm?",
    opts: ["Always force the risky one", "Choose based on what's actually open, not what looks flashy", "Panic and clear it"],
    a: 1, why: "Calm decision-making means reading the real picture, not forcing a play that isn't there." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder", "Right Midfielder"],
    q: "Your Right Midfielder is calling for the ball but is tightly marked. What do you do?",
    opts: ["Force the pass to her anyway", "Look for a better, truly open option", "Kick the ball away"],
    a: 1, why: "A calm player passes to who's actually open, not just who's asking loudest." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder"],
    q: "You control a tricky bouncing ball with an opponent closing fast. What's the priority?",
    opts: ["Panic and swing wildly", "A composed touch that takes the ball away from pressure", "Try to trap it dead under pressure"],
    a: 1, why: "A calm, controlled touch under pressure is one of the most valuable skills in the middle of the field." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder", "Striker"],
    q: "You and your Striker are both open, but she has a clearer shot at goal. What's calm?",
    opts: ["Keep the ball yourself regardless", "Pass to her since she has the better chance", "Boot it long instead"],
    a: 1, why: "Recognizing who has the better option \u2014 even if it's a teammate \u2014 is a calm, team-first decision." },
  { pos: "Center Midfielder", pr: "Play Out Calmly", hi: ["Center Midfielder"],
    q: "It's a tense moment late in a close game and you're on the ball. Does that change your approach?",
    opts: ["Yes, always rush the decision", "No, stick to the same calm process every time", "Yes, always pass backward no matter what"],
    a: 1, why: "Composure matters most exactly when the moment feels biggest \u2014 the process shouldn't change." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder", "Striker"],
    q: "You win the ball in midfield and the Striker is already sprinting forward. What's the move?",
    opts: ["Slow down and dribble carefully", "Play it into her run right away", "Pass sideways instead"],
    a: 1, why: "A run into space only works if the pass arrives while the gap is still open." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder"],
    q: "You intercept a pass and the opponent's defense is caught upfield. What's smart?",
    opts: ["Take your time building up", "Move the ball forward quickly before they recover shape", "Play it backward to reset"],
    a: 1, why: "A defense caught out of position won't stay that way long \u2014 quick decisions punish it." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder", "Left Midfielder"],
    q: "You win the ball and your Left Midfielder calls for a quick pass forward. What do you do?",
    opts: ["Ignore the call and slow it down", "Play it to her quickly to keep the break moving", "Pass backward instead"],
    a: 1, why: "Keeping a fast break alive means trusting the quick option in the moment." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder"],
    q: "Your team wins a free kick just past midfield with the other team's defense scrambling. What's the mindset?",
    opts: ["Take your time setting it up", "Take it quickly while they're still disorganized", "Play it backward to reset"],
    a: 1, why: "A quick restart can catch a defense before it gets back into shape." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder", "Right Midfielder"],
    q: "After winning the ball, your Right Midfielder is already making a run into space. What's the pass?",
    opts: ["A slow ball to her feet", "A firm, well-timed ball into the space ahead of her", "Hold the ball and wait"],
    a: 1, why: "Playing into the run \u2014 ahead of her \u2014 is what actually attacks the gap." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder"],
    q: "You win a tackle with a big open gap in front of you. What's the choice?",
    opts: ["Always pass backward out of habit", "Drive forward into the space yourself", "Stop and wait for instructions"],
    a: 1, why: "Sometimes the fastest way to attack a gap is to carry the ball forward yourself." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder", "Defensive Midfielder"],
    q: "A quick one-two with your Defensive Midfielder opens space ahead. What's the decision?",
    opts: ["Take an extra unnecessary touch", "Keep it one-touch to keep the move flowing", "Dribble instead of passing"],
    a: 1, why: "Fast combination play only works if the passes stay quick \u2014 hesitation lets the gap close." },
  { pos: "Center Midfielder", pr: "Attack the Gap Fast", hi: ["Center Midfielder"],
    q: "The instant your team regains possession, what's the first thing you look for?",
    opts: ["An automatic pass sideways", "Any open space to attack before the other team resets", "Nothing \u2014 hold the ball and wait"],
    a: 1, why: "The moments right after winning the ball are when the biggest gaps exist." },

  // Right Midfielder — expanded
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder", "Right Defender"],
    q: "The ball is on the far left side of the field. Where do you go?",
    opts: ["Stay pinned wide on the right", "Tuck in centrally to stay compact with the team", "Sprint to the left side immediately"],
    a: 1, why: "When the ball is far away, tucking in keeps the midfield line connected and hard to play through." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder", "Defensive Midfielder"],
    q: "Your Defensive Midfielder is under pressure with no easy outlet. What do you do?",
    opts: ["Stay wide and wait", "Drift inside to offer a passing option", "Push all the way forward"],
    a: 1, why: "Staying connected sometimes means giving up your normal spot to support a teammate under pressure." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder", "Right Defender"],
    q: "Your Right Defender pushes forward to overlap you. What's your job?",
    opts: ["Also push forward at the same time, leaving no width", "Tuck slightly inside to balance the width", "Stay exactly where you were"],
    a: 1, why: "When your fullback overlaps, shifting inside keeps the team's shape balanced instead of both of you being on the line." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder"],
    q: "Your team is defending deep in your own half. Where should you be?",
    opts: ["Staying high up the field", "Tracking back to help make the defense compact", "Standing near the corner flag"],
    a: 1, why: "Staying connected on defense means tracking back, not staying forward waiting for a counterattack." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder", "Center Midfielder"],
    q: "The midfield line is spread too far apart horizontally. What fixes it?",
    opts: ["Nothing changes", "Everyone tightens the spacing together", "Only you adjust, nobody else"],
    a: 1, why: "A stretched midfield line is easy to play through \u2014 staying connected means everyone tightening up together." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder"],
    q: "Your team just won the ball back deep in your own half. Where should you position yourself?",
    opts: ["Stay exactly where you were, far forward", "Move into a supporting passing lane nearby", "Sprint to the other team's goal immediately"],
    a: 1, why: "Right after winning the ball, staying connected and available for a pass matters more than sprinting forward alone." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder", "Striker"],
    q: "The Striker drops deep looking for support. What do you do?",
    opts: ["Ignore her and stay wide", "Provide an option so she's not isolated", "Push even higher up the field"],
    a: 1, why: "Staying connected to your attacking teammates means being available, not leaving them isolated." },
  { pos: "Right Midfielder", pr: "Stay Connected", hi: ["Right Midfielder"],
    q: "Your team is protecting a lead late in the game. How aggressive should your positioning be?",
    opts: ["Very aggressive, push forward constantly", "More disciplined and compact than usual", "No different than any other moment"],
    a: 1, why: "Protecting a lead calls for extra discipline in shape \u2014 staying connected matters even more." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder", "Right Defender"],
    q: "An attacker beats your Right Defender near the touchline. What's your job?",
    opts: ["Ignore it, that's her zone", "Track back to help win the ball as a pair", "Push forward instead"],
    a: 1, why: "Winning it back together means tracking back to help, not leaving your defender alone." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder"],
    q: "You lose the ball in midfield right after receiving a pass. What's the team reaction?",
    opts: ["Nobody reacts, it's your mistake", "The closest teammates immediately press to win it back", "Everyone drops deep instead"],
    a: 1, why: "The instant the ball is lost, the whole team's job is to counter-press together." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder", "Defensive Midfielder"],
    q: "Your Defensive Midfielder presses the ball carrier. What's your job?",
    opts: ["Also chase the same ball", "Cut off a nearby passing lane", "Stand still and watch"],
    a: 1, why: "Pressing together means covering different options, not everyone chasing the ball at once." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder"],
    q: "The ball is loose after a bad touch near your zone. What's the priority?",
    opts: ["Wait to see who reacts first", "Sprint to win it immediately", "Stand off and let it roll out"],
    a: 1, why: "Whoever is closest to a loose ball should attack it right away." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder", "Right Defender"],
    q: "An attacker is dribbling at both you and your Right Defender. What's the plan?",
    opts: ["Both challenge at the same time", "One delays while the other angles to cut off her options", "Neither engages"],
    a: 1, why: "Two defenders working together \u2014 one delaying, one covering \u2014 is stronger than both diving in." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder"],
    q: "Your team just got dribbled past in midfield. What's your job as the play develops?",
    opts: ["Stand still and watch", "Recover quickly to help outnumber the attacker", "Push forward instead"],
    a: 1, why: "Recovering to help win the ball back together is exactly what winning it back as a team looks like." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder", "Center Midfielder"],
    q: "Your Center Midfielder wins a tackle but is under pressure immediately. What's your job?",
    opts: ["Ignore her and stay wide", "Move to give her a quick, safe passing option", "Push all the way forward"],
    a: 1, why: "Supporting a teammate right after she wins the ball is part of winning it back together \u2014 securing it, not just recovering it." },
  { pos: "Right Midfielder", pr: "Win It Back Together", hi: ["Right Midfielder"],
    q: "An opponent turns with the ball right in front of you. What's the smart challenge?",
    opts: ["Dive in immediately", "Stay on your feet and delay while help arrives", "Back off completely"],
    a: 1, why: "Staying on your feet buys time for a teammate to arrive and help win the ball together." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder", "Right Defender"],
    q: "You receive the ball from your Right Defender under light pressure. What's calm?",
    opts: ["Panic and boot it forward", "Take a touch away from pressure and look for an option", "Pass it straight back immediately"],
    a: 1, why: "A calm first touch away from pressure buys time to find the smartest next pass." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder"],
    q: "You're facing your own goal with an opponent closing in behind you. What's smart?",
    opts: ["Try to spin and turn blindly", "Check your shoulder first, then decide whether to turn or lay it off", "Panic and force a pass"],
    a: 1, why: "Scanning before or right as you receive tells you whether it's actually safe to turn." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder", "Defensive Midfielder"],
    q: "You have the ball and no real pressure. What's the calm approach?",
    opts: ["Rush a risky pass anyway", "Take a moment, scan, and pick the smartest option", "Dribble aimlessly to burn time"],
    a: 1, why: "No pressure means no rush \u2014 this is when to make the smartest choice, not the fastest." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder"],
    q: "You're deciding between a risky pass through traffic or a simple one sideways. What's calm?",
    opts: ["Always force the risky one", "Choose based on what's actually open", "Panic and clear it"],
    a: 1, why: "Calm decision-making reads the real picture instead of forcing a play that isn't really there." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder", "Striker"],
    q: "The Striker is calling for the ball but is tightly marked. What do you do?",
    opts: ["Force the pass to her anyway", "Look for a better, truly open option", "Boot the ball away instead"],
    a: 1, why: "A calm player passes to whoever's actually open, not just whoever's loudest." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder"],
    q: "You control a difficult ball with a defender closing in fast. What's the priority?",
    opts: ["Panic and swing at it", "A composed touch that creates space from the pressure", "Try to stop it dead under pressure"],
    a: 1, why: "A calm first touch under pressure is one of the most valuable skills in midfield." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder", "Center Midfielder"],
    q: "You and your Center Midfielder are both open, but she has more time on the ball. What's calm?",
    opts: ["Keep it yourself regardless", "Pass to her since she has more space to work", "Boot it long instead"],
    a: 1, why: "Recognizing who has more time \u2014 even if it's a teammate \u2014 is a calm, team-first read." },
  { pos: "Right Midfielder", pr: "Play Out Calmly", hi: ["Right Midfielder"],
    q: "It's a tense, close moment in the game and you're on the ball. Does that change your approach?",
    opts: ["Yes, rush the decision", "No, stick to the same calm process every time", "Yes, always pass backward"],
    a: 1, why: "Composure matters most exactly when the moment feels biggest." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder", "Striker"],
    q: "You win the ball and the Striker is already sprinting into a gap ahead. What's the move?",
    opts: ["Slow down and dribble carefully", "Play it into her run right away", "Pass sideways instead"],
    a: 1, why: "That run into space only works if the pass arrives while the gap is still open." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder"],
    q: "You intercept a pass with the other team's defense caught upfield. What's smart?",
    opts: ["Take your time building up", "Move the ball forward quickly before they recover shape", "Play it backward to reset"],
    a: 1, why: "A defense caught out of position won't stay that way long \u2014 quick decisions punish it." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder", "Center Midfielder"],
    q: "Your Center Midfielder wins the ball and there's a big gap ahead. What's your job?",
    opts: ["Stay back just in case", "Make a forward run to give her an option", "Wait for her to dribble it herself"],
    a: 1, why: "Supporting a fast break means making runs too, not leaving one player to do it alone." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder"],
    q: "Your team wins a throw-in high up the field after a turnover. What's the mindset?",
    opts: ["Slow it right down and reset", "Take it quickly while their defense is scrambled", "Throw it backward to be safe"],
    a: 1, why: "A quick throw-in can catch a defense before it organizes." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder", "Right Defender"],
    q: "A give-and-go with your Right Defender opens a gap down the line. What's the decision?",
    opts: ["Take an extra unnecessary touch", "Keep it one-touch to keep the move flowing", "Dribble instead of passing"],
    a: 1, why: "Quick combination play only works if the passes stay quick." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder"],
    q: "You win a 50-50 ball with open space ahead of you. What's the choice?",
    opts: ["Play it safe backward immediately", "Drive forward into the space before it closes", "Stop and wait for instructions"],
    a: 1, why: "Winning the ball in open space is exactly the moment to attack forward." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder", "Striker"],
    q: "You clear a dangerous moment and see the Striker turning to run in behind. What's the pass?",
    opts: ["A slow ball to her feet", "A quick, well-weighted ball into the space ahead of her", "Hold it and wait"],
    a: 1, why: "Playing it into her run \u2014 not to her feet \u2014 is what actually attacks the open gap." },
  { pos: "Right Midfielder", pr: "Attack the Gap Fast", hi: ["Right Midfielder"],
    q: "The instant your team wins the ball back, what's your first read?",
    opts: ["An automatic pass sideways", "Any open space to attack before the other team resets", "Nothing \u2014 hold the ball"],
    a: 1, why: "The moments right after winning the ball are when the biggest gaps exist." },

  // Striker — expanded
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker", "Center Midfielder"],
    q: "Your team is building slowly through midfield. Where should you be?",
    opts: ["Standing still on the last defender's line", "Checking toward the ball to offer a passing option", "Staying near the corner flag"],
    a: 1, why: "Staying connected to the build-up means offering yourself as an option, not just waiting for a long ball." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker"],
    q: "Your team just lost the ball in midfield. What's your first job?",
    opts: ["Stay forward waiting for a counterattack", "Start pressing the nearest defender to slow the buildup", "Jog back to your own goal"],
    a: 1, why: "Staying connected to the team defensively means being the first line of pressure, not standing and waiting." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker", "Left Midfielder"],
    q: "Your Left Midfielder is under pressure with no forward passing option. What do you do?",
    opts: ["Stand still on the last line", "Drop slightly to give her a safe outlet", "Push even further forward"],
    a: 1, why: "Sometimes staying connected means coming short to help, even if it's not a glamorous run." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker"],
    q: "Your team is defending a corner kick. What's your job?",
    opts: ["Stay forward in case of a quick counter", "Track back to help defend the box", "Wait near midfield"],
    a: 1, why: "Everyone helps defend a dangerous set piece \u2014 staying connected means tracking back too." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker", "Center Midfielder"],
    q: "The ball is deep in your own half. Where should you position yourself?",
    opts: ["Stay pinned on the last defender regardless", "Drift into a spot where you could receive a pass out of pressure", "Stand still near the center circle"],
    a: 1, why: "Being a useful outlet even when the ball is deep is part of staying connected to your team." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker"],
    q: "Your team is protecting a slim lead late in the game. What's your positioning?",
    opts: ["Push forward constantly for a chance to score again", "Help apply pressure but stay disciplined defensively too", "Ignore the defensive side entirely"],
    a: 1, why: "Protecting a lead is a team effort \u2014 even the Striker helps stay connected and compact." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker", "Right Midfielder"],
    q: "Your Right Midfielder is isolated on the wing with no support. What do you do?",
    opts: ["Stay central and ignore it", "Drift over to give her a passing option", "Push forward without helping"],
    a: 1, why: "Staying connected sometimes means adjusting your position to support a teammate who's isolated." },
  { pos: "Striker", pr: "Stay Connected", hi: ["Striker"],
    q: "Your team's shape gets stretched during a fast transition. What's your job?",
    opts: ["Sprint even further away from your teammates", "Find a position that keeps you reachable by a pass", "Stand completely still"],
    a: 1, why: "Even in transition, staying reachable for a pass keeps you connected to the play." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker"],
    q: "The opponent's Goalkeeper is about to play a short pass to a defender. What's your job?",
    opts: ["Stand still and watch", "Press to force a rushed pass or mistake", "Drop all the way back"],
    a: 1, why: "A Striker's press can start a team's press from the very front \u2014 forcing panic in the other team's build-up." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker", "Center Midfielder"],
    q: "You press the opponent's center back and she plays a pass anyway. What happens next?",
    opts: ["Nothing, your job is done", "Your Center Midfielder picks up the pressure on the next pass", "Everyone stops pressing"],
    a: 1, why: "Pressing as a team means the pressure continues from the next player, not just one person." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker"],
    q: "You lose the ball trying to hold it up against a defender. What's the team response?",
    opts: ["Nobody reacts, it's your mistake alone", "The nearest teammates immediately close in to win it back", "Everyone drops deep instead"],
    a: 1, why: "Winning it back together means an instant reaction from teammates, not blame on one player." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker", "Left Midfielder"],
    q: "The opponent's defender receives a pass under a bit of pressure. What's your role?",
    opts: ["Stand off completely", "Angle your run to cut off her easiest passing option", "Chase the ball no matter where it goes"],
    a: 1, why: "Smart pressing isn't just chasing the ball \u2014 it's cutting off the easy options too." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker"],
    q: "The ball is loose near the edge of the opponent's box after a bad clearance. What's your instinct?",
    opts: ["Wait to see who reacts first", "Attack it immediately to win it for the team", "Stand off and let it roll out"],
    a: 1, why: "A Striker who reacts fastest to loose balls in the box creates chances for the whole team." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker", "Right Midfielder"],
    q: "Your Right Midfielder presses high but gets bypassed. What's your job?",
    opts: ["Do nothing, that's her zone", "Adjust to cover the next pass", "Push even further forward alone"],
    a: 1, why: "Winning it back together means adjusting instantly when the first press doesn't work." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker"],
    q: "You win the ball high up the field in a tackle. What's next?",
    opts: ["Boot it away immediately without looking", "Look for a quick, smart way to keep the attack going", "Sit on the ball to waste time"],
    a: 1, why: "Winning the ball back near their goal is only useful if you use it well right after." },
  { pos: "Striker", pr: "Win It Back Together", hi: ["Striker", "Center Midfielder"],
    q: "The opponent's defense is trying to play out under your pressure. What's the team plan?",
    opts: ["Everyone presses the same single defender", "You and your Center Midfielder cover different passing lanes", "Nobody presses at all"],
    a: 1, why: "Pressing as a coordinated pair closes off more options than everyone chasing the ball." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker", "Center Midfielder"],
    q: "You receive the ball with your back to goal and a defender tight on you. What's calm?",
    opts: ["Force a spin immediately", "Shield it and lay it off to a supporting teammate", "Panic and lose control"],
    a: 1, why: "Holding up play calmly and laying it off is often smarter than forcing a turn under pressure." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker"],
    q: "You're through on goal but a defender is recovering fast. What's composed?",
    opts: ["Rush the shot without settling", "Take the extra half-second to pick your spot", "Panic and shoot wildly"],
    a: 1, why: "Composure in the biggest moments is what turns a chance into a goal." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker", "Left Midfielder"],
    q: "You have a simple pass available or a flashier risky one. Light pressure is on you. What's calm?",
    opts: ["Always force the flashy option", "Take the simple option that keeps the move going", "Panic and boot it away"],
    a: 1, why: "Calm play often means choosing the effective option over the flashy one." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker"],
    q: "You control the ball in the box with a defender closing fast. What's the priority?",
    opts: ["Panic and take a wild touch", "A composed touch that sets up your next move", "Try to control it perfectly still"],
    a: 1, why: "A calm, purposeful touch in a tight space is what creates a real scoring chance." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker", "Right Midfielder"],
    q: "Your Right Midfielder is calling for a risky pass into a crowd. What's the calm choice?",
    opts: ["Force it to her anyway since she's calling", "Look for a better, safer option first", "Panic and clear it"],
    a: 1, why: "A calm player reads the field, not just who's asking loudest." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker"],
    q: "You're one-on-one with the goalkeeper. What's the composed approach?",
    opts: ["Rush a shot from a bad angle", "Take a touch to set up the best possible shot", "Panic and pass instead"],
    a: 1, why: "The calmest players make the defender or keeper move first, instead of rushing the decision." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker", "Center Midfielder"],
    q: "You have the ball at the top of the box with no clear shot. What's calm?",
    opts: ["Force a shot anyway", "Recycle it to a teammate in a better position", "Panic and dribble into trouble"],
    a: 1, why: "Sometimes the calm, smart play is giving it up for a better chance, not forcing your own shot." },
  { pos: "Striker", pr: "Play Out Calmly", hi: ["Striker"],
    q: "It's a tense moment with the game on the line and the ball comes to you. Does that change your approach?",
    opts: ["Yes, always rush the decision", "No, stick to the same calm process every time", "Yes, always pass it away immediately"],
    a: 1, why: "Composure matters most exactly when the moment feels biggest." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker", "Center Midfielder"],
    q: "Your Center Midfielder wins the ball and looks up. What should you already be doing?",
    opts: ["Standing still waiting for instructions", "Sprinting into the open space behind the defense", "Jogging back toward your own goal"],
    a: 1, why: "The best runs start the instant the ball is won, not after the pass is already played." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker"],
    q: "The opponent's defense is caught high up the field after a turnover. What's your move?",
    opts: ["Wait for everyone to catch up first", "Sprint immediately into the space in behind", "Stand still near midfield"],
    a: 1, why: "A high defensive line that's just been caught out is exactly the gap a Striker should attack." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker", "Left Midfielder"],
    q: "Your Left Midfielder is about to play a ball into space. What's your job?",
    opts: ["Stand still and wait for it to arrive", "Time your run to arrive just as the ball does", "Sprint way too early and get caught offside"],
    a: 1, why: "Timing the run \u2014 not just making it \u2014 is what turns a good pass into a real chance." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker"],
    q: "Your team wins the ball back deep in the other team's half. What's the mindset?",
    opts: ["Slow it down and reset completely", "React fast to attack before their defense recovers", "Jog back to your own half first"],
    a: 1, why: "Winning the ball high up the field is a huge opportunity if you react to it fast." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker", "Right Midfielder"],
    q: "A quick give-and-go with your Right Midfielder could break the defensive line. What's the decision?",
    opts: ["Take an extra unnecessary touch", "Play it one-touch to keep the move quick", "Dribble instead of passing"],
    a: 1, why: "Fast combination play only works if the passes stay quick enough to beat the defense's recovery." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker"],
    q: "You're through on goal after a turnover, with a defender chasing from behind. What's smart?",
    opts: ["Slow down to let her catch up", "Keep driving forward at full speed", "Stop and wait for support"],
    a: 1, why: "Once you're in behind, speed is what keeps the gap open \u2014 hesitating lets the defender recover." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker", "Center Midfielder"],
    q: "The instant your team wins the ball, what's the first read you make?",
    opts: ["An automatic jog back to position", "Whether there's a gap to attack immediately", "Nothing \u2014 wait for a teammate to decide"],
    a: 1, why: "The moments right after winning the ball are when the biggest gaps exist \u2014 a Striker should always look first." },
  { pos: "Striker", pr: "Attack the Gap Fast", hi: ["Striker"],
    q: "You receive a through ball in a foot race with the defender. What's the priority?",
    opts: ["Slow down to control it perfectly first", "Get to the ball first and take your touch in stride", "Wait for the defender to commit"],
    a: 1, why: "Winning the race to the ball is what turns a gap into a real chance \u2014 control comes after." },
];

const ROUND_SIZE = 10;
const LEVELS = [
  { min: 0, name: "Rookie" },
  { min: 300, name: "Starter" },
  { min: 650, name: "Playmaker" },
  { min: 950, name: "Captain" },
  { min: 1200, name: "Coach's Brain" },
];

function levelFor(score) {
  let l = LEVELS[0].name;
  for (const lv of LEVELS) if (score >= lv.min) l = lv.name;
  return l;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic weekly rotation: everyone on the team gets the same question set
// for a given position during a given homework week. A fresh set drops every FRIDAY,
// to be completed before next week's first practice.
function fridayStart() {
  const now = new Date();
  const day = (now.getDay() + 2) % 7; // days since the most recent Friday (Fri=0)
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
}
function weekEpoch() {
  return Math.floor(fridayStart().getTime() / 604800000);
}
function weekLabel() {
  return fridayStart().toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
function seededShuffle(arr, seed) {
  const rand = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(myPos, extraOffset = 0) {
  // This week's homework: the same 10 questions for every player at a given position,
  // rotating automatically each Monday. 7 position scenarios + 3 whole-team questions.
  // extraOffset is 0 for the first ATTEMPTS_BEFORE_SHUFFLE plays (identical set for
  // everyone), and a per-attempt value beyond that so replays past the cap get a
  // fresh mix instead of the same memorizable 10.
  const seed = weekEpoch() * 7919 + hashStr(myPos) + extraOffset * 104729;
  if (myPos === "All") return seededShuffle(QUESTIONS, seed).slice(0, ROUND_SIZE);
  const mine = QUESTIONS.filter((q) => q.pos === myPos);
  const team = QUESTIONS.filter((q) => q.pos === "Team" && (q.hi.length === 0 || q.hi.includes(myPos)));
  const nMine = Math.min(7, mine.length);
  const picked = [
    ...seededShuffle(mine, seed).slice(0, nMine),
    ...seededShuffle(team, seed + 1).slice(0, ROUND_SIZE - nMine),
  ];
  return seededShuffle(picked, seed + 2);
}
const ATTEMPTS_BEFORE_SHUFFLE = 3;

// Short labels just for the tiny field diagram (space is tight on a phone)
const FIELD_LABEL = {
  "Goalkeeper": "GK", "Left Defender": "LD", "Center Defender": "CD", "Right Defender": "RD",
  "Defensive Midfielder": "DM", "Left Midfielder": "LM", "Center Midfielder": "CM", "Right Midfielder": "RM", "Striker": "ST",
};

// ---------- Field diagram ----------
// primary = the "you" position (bright volt). others = teammates in the scenario (blue).
function Field({ primary, others = [] }) {
  return (
    <svg viewBox="0 0 200 300" style={{ width: "100%", maxWidth: 200, display: "block" }} aria-label="Field diagram showing the players in this scenario">
      <rect x="4" y="4" width="192" height="292" rx="10" fill="none" stroke={C.line} strokeWidth="2.5" />
      <line x1="4" y1="150" x2="196" y2="150" stroke={C.line} strokeWidth="2" />
      <circle cx="100" cy="150" r="26" fill="none" stroke={C.line} strokeWidth="2" />
      <rect x="55" y="4" width="90" height="38" fill="none" stroke={C.line} strokeWidth="2" />
      <rect x="55" y="258" width="90" height="38" fill="none" stroke={C.line} strokeWidth="2" />
      {POSITIONS.map((p) => {
        const s = FIELD_SPOTS[p];
        const cx = (s.x / 100) * 184 + 8;
        const cy = 292 - (s.y / 100) * 280;
        const isPrimary = p === primary;
        const isOther = others.includes(p);
        const lit = isPrimary || isOther;
        return (
          <g key={p} style={isPrimary ? { transformOrigin: `${cx}px ${cy}px`, animation: "pulseDot 1.6s ease-in-out infinite" } : {}}>
            <circle cx={cx} cy={cy} r={lit ? 11 : 6.5}
              fill={isPrimary ? C.volt : isOther ? C.sky : "rgba(247,244,233,0.22)"}
              stroke={lit ? C.chalk : "none"} strokeWidth="2" />
            {lit && (
              <text x={cx} y={cy + 4} textAnchor="middle" fill={isPrimary ? C.chalk : C.pitchDeep}
                style={{ fontFamily: "'Nunito'", fontWeight: 800, fontSize: 9.5 }}>{FIELD_LABEL[p]}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Main ----------
export default function TacticsTrainer() {
  const [screen, setScreen] = useState("home"); // home | play | done | board
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");
  const [saved, setSaved] = useState(null); // null | "saving" | "ok" | "fail"
  const savedFor = useRef(null);
  const [board, setBoard] = useState(null); // null = not loaded yet, [] once fetched
  const [boardErr, setBoardErr] = useState(false);
  const [myPos, setMyPos] = useState("All");
  const [round, setRound] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [picked, setPicked] = useState(null);
  const [prStats, setPrStats] = useState({});
  const [starting, setStarting] = useState(false);
  const [freshMix, setFreshMix] = useState(false); // true if this round used a shuffled-past-the-cap set

  const q = round[idx];
  const optOrder = useMemo(() => (q ? shuffle([0, 1, 2]) : [0, 1, 2]), [q]);
  const showField = q && q.hi && q.hi.length > 0;

  async function start() {
    if (starting) return;
    setStarting(true);
    let attempts = 0;
    try {
      const { data, error } = await supabase.rpc("smarts_attempt_count", {
        p_jersey: jersey.trim(), p_week: weekEpoch(), p_position: myPos,
      });
      if (!error && typeof data === "number") attempts = data;
    } catch (_) { /* network hiccup — fail open to the official set */ }
    const isFresh = attempts >= ATTEMPTS_BEFORE_SHUFFLE;
    setFreshMix(isFresh);
    setRound(buildRound(myPos, isFresh ? attempts + 1 : 0));
    setIdx(0); setScore(0); setStreak(0); setBestStreak(0);
    setPicked(null); setPrStats({});
    savedFor.current = null; setSaved(null);
    setStarting(false);
    setScreen("play");
  }

  function choose(i) {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === q.a;
    setPrStats((s) => {
      const cur = s[q.pr] || { right: 0, total: 0 };
      return { ...s, [q.pr]: { right: cur.right + (correct ? 1 : 0), total: cur.total + 1 } };
    });
    if (correct) {
      const bonus = Math.min(streak, 4) * 25;
      setScore((s) => s + 100 + bonus);
      setStreak((s) => { const n = s + 1; setBestStreak((b) => Math.max(b, n)); return n; });
    } else {
      setStreak(0);
    }
  }

  function next() {
    if (idx + 1 >= round.length) { setScreen("done"); }
    else { setIdx(idx + 1); setPicked(null); }
  }

  useEffect(() => {
    if (screen !== "done") return;
    const key = `${weekEpoch()}-${round.length}-${score}-${Date.now()}`;
    if (savedFor.current === screen + idx) return;
    savedFor.current = screen + idx;
    setSaved("saving");
    supabase.from("smarts_sessions").insert({
      jersey: jersey.trim(), player_name: name.trim(), position: myPos,
      week_epoch: weekEpoch(), week_label: weekLabel(), score, best_streak: bestStreak, principles: prStats,
    }).then(({ error }) => setSaved(error ? "fail" : "ok"));
  }, [screen]);

  useEffect(() => {
    if (screen !== "board") return;
    setBoardErr(false);
    supabase.rpc("public_homework_leaderboard").then(({ data, error }) => {
      if (error) { setBoardErr(true); return; }
      setBoard(data || []);
    });
  }, [screen]);

  function retrySave() {
    setSaved("saving");
    supabase.from("smarts_sessions").insert({
      jersey: jersey.trim(), player_name: name.trim(), position: myPos,
      week_epoch: weekEpoch(), week_label: weekLabel(), score, best_streak: bestStreak, principles: prStats,
    }).then(({ error }) => setSaved(error ? "fail" : "ok"));
  }

  const scoreText = `#${jersey.trim() || "?"} ${name.trim() || "Player"} \u2014 ${myPos === "All" ? "All positions" : myPos} \u2014 Week of ${weekLabel()} \u2014 ${score} pts, best streak ${bestStreak} \u2014 ${levelFor(score)}`;

  const shell = {
    minHeight: "100vh", background: `radial-gradient(circle at 50% 0%, ${C.pitch}, ${C.pitchDeep} 70%)`,
    color: C.chalk, fontFamily: "'Nunito', sans-serif", padding: "20px 16px 40px",
    display: "flex", flexDirection: "column", alignItems: "center",
  };
  const card = {
    background: C.panel, border: `1.5px solid ${C.line}`, borderRadius: 16,
    padding: 18, width: "100%", maxWidth: 440, animation: "slideUp .3s ease",
  };
  const btn = (bg, fg = C.chalk) => ({
    background: bg, color: fg, border: "none", borderRadius: 12, padding: "13px 18px",
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 16, cursor: "pointer", width: "100%",
  });
  const display = { fontFamily: "'Lilita One', sans-serif", fontWeight: 400, letterSpacing: 0.5 };

  return (
    <div style={shell}>
      <style>{FONT_CSS}</style>

      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ ...display, fontSize: 34, lineHeight: 1.05, color: C.volt }}>SOCCER SMARTS ⚽</div>
        <div style={{ color: C.chalkDim, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          {`Week of ${weekLabel()} · 3-4-1 · v24`}
        </div>
      </div>

      {screen === "home" && (
        <div style={card}>
          <label style={{ fontSize: 13, fontWeight: 800, color: C.chalkDim, textTransform: "uppercase", letterSpacing: 1 }}>
            Your number and first name
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 6, marginBottom: 16 }}>
            <input value={jersey} onChange={(e) => setJersey(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="#" aria-label="Jersey number"
              style={{ width: 72, boxSizing: "border-box", padding: "12px 10px", borderRadius: 10, border: `1.5px solid ${jersey ? C.volt : C.line}`, background: C.pitchDeep, color: C.chalk, fontSize: 18, textAlign: "center", fontFamily: "'Nunito'", fontWeight: 800 }} />
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={14} placeholder="Your name here"
              style={{ flex: 1, boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.line}`, background: C.pitchDeep, color: C.chalk, fontSize: 16, fontFamily: "'Nunito'", fontWeight: 700 }} />
          </div>

          <label style={{ fontSize: 13, fontWeight: 800, color: C.chalkDim, textTransform: "uppercase", letterSpacing: 1 }}>
            Your position
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 18 }}>
            {["All", ...POSITIONS].map((p) => (
              <button key={p} onClick={() => setMyPos(p)}
                style={{ padding: "8px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "'Nunito'", fontWeight: 800, fontSize: 13, border: `1.5px solid ${myPos === p ? C.volt : C.line}`, background: myPos === p ? C.volt : "transparent", color: C.chalk }}>
                {p}
              </button>
            ))}
          </div>

          <button onClick={start} disabled={!jersey.trim() || starting} style={{ ...btn(C.volt), opacity: jersey.trim() && !starting ? 1 : .45 }}>
            {starting ? "Loading…" : jersey.trim() ? "Kick off — this week's 10" : "Enter your number to kick off"}
          </button>
          <p style={{ fontSize: 12, color: C.chalkDim, marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
            This week's 10 homework questions are the same for everyone at your position — a fresh set drops every Friday. When you finish, your score goes straight to the coaches. Play before next week's first practice — after {ATTEMPTS_BEFORE_SHUFFLE} plays on the same set, replays switch to a fresh mix of questions so it stays a real workout, and every play still adds to your season points.
          </p>
          <button onClick={() => setScreen("board")} style={{ ...btn("transparent", C.chalk), border: `1.5px solid ${C.line}`, marginTop: 12 }}>
            🏆 Leaderboard
          </button>
        </div>
      )}

      {screen === "board" && (
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ ...display, fontSize: 20 }}>🏆 Leaderboard</div>
            <button onClick={() => setScreen("home")} style={{ marginLeft: "auto", background: "transparent", border: 0, color: C.chalkDim, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Back</button>
          </div>
          {boardErr && <p style={{ fontSize: 14, color: C.chalkDim }}>Couldn't load the leaderboard. Try again in a bit.</p>}
          {!boardErr && board === null && <p style={{ fontSize: 14, color: C.chalkDim }}>Loading…</p>}
          {!boardErr && board && board.length === 0 && <p style={{ fontSize: 14, color: C.chalkDim }}>No scores yet this season — be the first!</p>}
          {!boardErr && board && board.length > 0 && (
            <div>
              <div style={{ display: "flex", fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.chalkDim, textTransform: "uppercase", padding: "0 0 6px", borderBottom: `1.5px solid ${C.line}` }}>
                <span style={{ flex: 1 }}>Player</span><span style={{ width: 46, textAlign: "right" }}>Wks</span><span style={{ width: 46, textAlign: "right" }}>Best</span><span style={{ width: 60, textAlign: "right" }}>Points</span>
              </div>
              {board.map((r, i) => (
                <div key={r.jersey} style={{ display: "flex", alignItems: "center", fontSize: 14, padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontWeight: r.jersey === jersey.trim() ? 800 : 700, color: r.jersey === jersey.trim() ? C.volt : C.chalk }}>
                  <span style={{ flex: 1 }}>{i < 3 ? ["🥇", "🥈", "🥉"][i] + " " : `${i + 1}. `}#{r.jersey} {r.display_name}</span>
                  <span style={{ width: 46, textAlign: "right" }}>{r.weeks}</span>
                  <span style={{ width: 46, textAlign: "right" }}>{r.best}</span>
                  <span style={{ width: 60, textAlign: "right" }}>{r.points}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {screen === "play" && q && (
        <div style={card} key={idx}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ ...display, fontSize: 20, color: C.volt }}>{score}<span style={{ fontSize: 12, color: C.chalkDim, marginLeft: 4 }}>PTS</span></div>
            <div style={{ fontSize: 13, fontWeight: 800, color: streak >= 2 ? C.volt : C.chalkDim }}>
              {streak >= 2 ? `🔥 ${streak} in a row` : `Q ${idx + 1} of ${round.length}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: PRINCIPLES[q.pr].color, border: `1.5px solid ${PRINCIPLES[q.pr].color}`, borderRadius: 999, padding: "3px 10px" }}>
                {q.pr}
              </span>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.chalkDim, marginTop: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                {q.pos === "Team" ? "Whole team \u2014 everyone\u2019s job" : `You are the ${q.pos}`}
              </div>
              <p style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.45, marginTop: 6 }}>{q.q}</p>
            </div>
            {showField && (
              <div style={{ width: 108, flexShrink: 0 }}>
                <Field primary={q.pos === "Team" ? null : q.hi[0]} others={q.pos === "Team" ? q.hi : q.hi.slice(1)} />
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 8 }}>
            {optOrder.map((oi) => {
              const isPicked = picked === oi;
              const isRight = oi === q.a;
              let bg = C.pitchDeep, border = C.line, colr = C.chalk;
              let prefix = "";
              if (picked !== null) {
                if (isRight) { bg = C.volt; colr = C.chalk; border = C.volt; prefix = "\u2713 "; }
                else if (isPicked) { bg = "transparent"; border = C.chalk; colr = C.chalkDim; prefix = "\u2717 "; }
                else { colr = C.chalkDim; }
              }
              return (
                <button key={oi} onClick={() => choose(oi)}
                  style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${border}`, background: bg, color: colr, fontFamily: "'Nunito'", fontWeight: 700, fontSize: 15, cursor: picked === null ? "pointer" : "default", lineHeight: 1.35 }}>
                  {prefix}{q.opts[oi]}
                </button>
              );
            })}
          </div>

          {picked !== null && (
            <div style={{ marginTop: 14, padding: 14, borderRadius: 12, background: C.pitchDeep, border: `1.5px solid ${picked === q.a ? C.volt : C.line}`, animation: "popIn .25s ease" }}>
              <div style={{ ...display, fontSize: 17, color: picked === q.a ? "#FF6B75" : C.chalkDim }}>
                {picked === q.a ? (streak >= 3 ? "ON FIRE!" : "GOAL! Nice read.") : "Not this time —"}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: "6px 0 12px", color: C.chalk }}>{q.why}</p>
              <button onClick={next} style={btn(C.chalk, C.pitchDeep)}>
                {idx + 1 >= round.length ? "See final score" : "Next play →"}
              </button>
            </div>
          )}
        </div>
      )}

      {screen === "done" && (
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: C.chalkDim }}>Full time</div>
          <div style={{ ...display, fontSize: 52, color: C.volt, margin: "4px 0" }}>{score}</div>
          <div style={{ ...display, fontSize: 20, color: C.chalk }}>{levelFor(score)}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.chalkDim, marginTop: 4 }}>Best streak: {bestStreak} in a row</div>
          {freshMix && (
            <div style={{ fontSize: 12, fontWeight: 700, color: C.volt, marginTop: 6 }}>🔀 Fresh mix — you've played the official set enough this week!</div>
          )}

          <div style={{ marginTop: 16, textAlign: "left" }}>
            {Object.entries(prStats).map(([pr, s]) => (
              <div key={pr} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 800 }}>
                  <span style={{ color: PRINCIPLES[pr].color }}>{pr}</span>
                  <span style={{ color: C.chalkDim }}>{s.right}/{s.total}</span>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: "rgba(247,244,233,0.12)", marginTop: 3 }}>
                  <div style={{ height: 6, borderRadius: 4, width: `${(s.right / s.total) * 100}%`, background: PRINCIPLES[pr].color }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: C.pitchDeep, border: `1.5px solid ${C.volt}`, textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: C.volt, marginBottom: 6 }}>
              Homework done? Prove it!
            </div>
            <p style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.5, margin: "0 0 8px" }}>
              {saved === "ok" ? "✅ Saved — your coaches can see this score." : saved === "fail" ? "⚠️ Couldn't save your score." : "Saving your score…"}
            </p>
            {saved === "fail" && (<>
              <button onClick={retrySave} style={{ ...btn(C.volt), marginBottom: 8 }}>Try saving again</button>
              <p style={{ fontSize: 13, opacity: .8, margin: "0 0 8px" }}>Still stuck? Screenshot this page and post it in GameChanger.</p>
            </>)}
            <p style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.5, margin: 0, color: C.chalkDim, wordBreak: "break-word" }}>{scoreText}</p>
          </div>

          <button onClick={start} style={{ ...btn("transparent", C.chalk), border: `1.5px solid ${C.line}`, marginTop: 10 }}>
            Play again
          </button>
        </div>
      )}

    </div>
  );
}
