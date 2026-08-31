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
const POSITIONS = ["Goalkeeper", "Left Defender", "Center Defender", "Right Defender", "Defensive Midfielder", "Left Midfielder", "Center Midfielder", "Right Midfielder", "Striker"];

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

function buildRound(myPos) {
  // This week's homework: the same 10 questions for every player at a given position,
  // rotating automatically each Monday. 7 position scenarios + 3 whole-team questions.
  const seed = weekEpoch() * 7919 + hashStr(myPos);
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
  const [myPos, setMyPos] = useState("All");
  const [round, setRound] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [picked, setPicked] = useState(null);
  const [prStats, setPrStats] = useState({});

  const q = round[idx];
  const optOrder = useMemo(() => (q ? shuffle([0, 1, 2]) : [0, 1, 2]), [q]);
  const showField = q && q.hi && q.hi.length > 0;

  function start() {
    setRound(buildRound(myPos));
    setIdx(0); setScore(0); setStreak(0); setBestStreak(0);
    setPicked(null); setPrStats({});
    savedFor.current = null; setSaved(null);
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
          {`Week of ${weekLabel()} · 3-4-1 · v15`}
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

          <button onClick={start} disabled={!jersey.trim()} style={{ ...btn(C.volt), opacity: jersey.trim() ? 1 : .45 }}>
            {jersey.trim() ? "Kick off — this week's 10" : "Enter your number to kick off"}
          </button>
          <p style={{ fontSize: 12, color: C.chalkDim, marginTop: 14, marginBottom: 0, lineHeight: 1.5 }}>
            This week's 10 homework questions are the same for everyone at your position — a fresh set drops every Friday. When you finish, your score goes straight to the coaches. Play before next week's first practice, and replay all you want — your best score is the one that counts.
          </p>
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
              {saved === "ok" ? "✅ Saved — your coaches can see this score." : saved === "fail" ? "📸 Couldn't save. Screenshot this page and post it in GameChanger." : "Saving your score…"}
            </p>
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
