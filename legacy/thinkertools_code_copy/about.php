<?php session_start(); 
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools about</title>
		<link rel="stylesheet" href="main.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="mainhead.css" content="text/html; charset=utf-8"/>
		<!-- style cards -->
		<style>
			.aboutheader {
				margin-top: 24px; margin-left: 420px; width: 360px; height: 40px; background-color: white; border: 1px solid black; padding-top: 12px; font-size: 24px; text-align: center;
			}
			.cardrow {
				width: 1200px; margin-top: 24px; margin-bottom: 24px;
			}
			.cardspace {
				float: left; width: 240px; padding-top: 36px;
			}
			.cardhr {
				border: 1px solid #C63232;
			}
			.cardvr {
				margin-top: -8px; margin-left: 115px; width: 1px; height: 60px; border: .5px solid #C63232; background-color: #C63232;
			}
			.cardcircle {
				margin-left: 95px; margin-top: -80px; width: 36px; height: 36px; border: 2px solid #C63232; background-color: #F5F5F5; border-radius: 50%; clear: both;
			}
			.card {
				width: 200px; height: 250px; margin-left: 8px; margin-top: 30px; padding: 6px; background-color: white; border: 1px solid #C63232; line-height: 24px; text-align: center;
			}
			.cardselect {
				width: 520px; margin-left: -180px; margin-top: -24px; margin-bottom: 12px; padding-left:12px; padding-bottom:12px; padding-right:12px; background-color: white; border: 1px solid #C63232; text-align:left; position: absolute; z-index: 1;
			}
		</style>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			
			<!-- <div class="cardhr" style="width: 100vw; margin-left: -200px;"></div> -->
			
			<div style="width: 1200px;">
				<div class="cardrow">
					<?php
					$select = 0;
					if (isset($_GET['select'])) $select = $_GET['select'];
					$card1 = "<strong>What We Do</strong><br /><br /><a href='about.php?select=1' class='textlink'>view</a><br /><br /><img src='images/mindlogo.jpg' alt='TT logo' width='150px' />";
					$card2 = "<strong>Web of Inquiry</strong><br /><br /><a href='about.php?select=2' class='textlink'>view</a><br /><br /><img src='images/grid_screenshot.png' alt='TT logo' width='150px' />";
					$card3 = "<strong>Thinkerspaces</strong><br /><br /><a href='about.php?select=3' class='textlink'>view</a><br /><br /><img src='images/thinkerspaces_screenshot.png' alt='TT logo' width='150px' />";
					$card4 = "<strong>Quipx</strong><br /><br /><a href='about.php?select=4' class='textlink'>view</a><br /><br /><img src='images/session_screenshot.png' alt='TT logo' width='150px' />";
					$card5 = "<strong>Help Us Grow</strong><br /><br /><a href='about.php?select=5' class='textlink'>view</a><br /><br /><img src='images/mindlogo.jpg' alt='TT logo' width='150px' />";
					$card = 1;
					while ($card<6) {
						print '
						<div class="cardspace">';
							print '<hr class="cardhr">';
							print '<div class="cardvr"></div>';
							if ($select == $card) print '<div class="cardcircle" style="background-color: #C63232;"></div>';
							else print '<div class="cardcircle"></div>';
							print '<div class="card">';
								if ($select == $card) {
									// what we do 
									if ($card == 1) {
										print '<div class="cardselect narrow" style="margin-left:-12px">
											<div style="float: right; padding: 4px;"><a href="about.php" class="textlink">close X</a></div>
											<br />
											<div style="text-align:center; margin-bottom:12px"><strong>What We Do</strong></div>
											We are dedicated to creating the best online platforms and tools to help any formal or informal group, ad hoc teams collaboratively build new knowledge. Thinkertools topics are universal, in other words, we aren\'t limiting our platforms to say the hard sciences like physics or biology. Are you seeking solutions to resolve local environmental problems through regenerative communities, or analyzing literature through a new paradigm, or creating a field of pandemic psychology? Thinkertools can help you. 
											<br /><br />
											Yes, we have tools that help people think.
											<br /><br />
											The Thinkertools team is a diverse group of learning researchers, technology designers, community partners, and support professionals, founded by Barbara White. For more information on the origins of Thinkertools, research and white papers, and answers to questions, please contact us: info@thinkertools.org 
											</span>
										</div>';
									}
									// WOI
									if ($card == 2) {
										print '<div class="cardselect narrow">
											<div style="float: right; padding: 4px;"><a href="about.php" class="textlink">close X</a></div>
											<br />
											<div style="text-align:center; margin-bottom:12px"><strong>Web of Inquiry</strong></div>
											<span style="teaxt-align:left">
											<a href="webofinquiry/home.php" class="textlink">The Web of Inquiry</a> helps you and your team answer questions, satisfy curiosity, and build knowledge by playing inquiry games. Play a live game, start a new game, connect with other games. If you\'re a teacher or professor, engage your students in their self-motivated inquiry game. If you\'re a member of a research team, the Web of Inquiry facilitates your group\'s knowledge building. If you\'re interested in a mystery no one has solved, try an inquiry game to find the answer. <br /><br />"The language of inquiry became our language of practice." (Web of Inquiry team member)
											</span>
										</div>';
									}
									// Thinkerspaces 
									if ($card == 3) {
										print '<div class="cardselect narrow">
											<div style="float: right; padding: 4px;"><a href="about.php" class="textlink">close X</a></div>
											<br />
											<div style="text-align:center; margin-bottom:12px"><strong>Thinkerspaces</strong></div>
											<span style="teaxt-align:left">
											<a href="http://thinkerspaces.org" class="textlink">Thinkerspaces</a> are  physical spaces that meld community-based problem solving, design and making, and regenerative principles. We form research-practice partnerships with local communities members and diverse experts that center on four core practices: 1) Meaningful, open-ended design inquiry and making, 2) Technology-enhanced collaborative sensemaking and team building, 3) Community engagement through problem-solving, and 4) Regenerative communities and restoring ecologies.<br /><br />
											"The teams created original and complex solutions to intergenerational learning with several STEAM concepts using human centered design." (Thinkerspaces workshop facilitator)
											</span>
										</div>';
									}
									// Quipx 
									if ($card == 4) {
										print '<div class="cardselect narrow">
											<div style="float: right; padding: 4px;"><a href="about.php" class="textlink">close X</a></div>
											<br />
											<div style="text-align:center; margin-bottom:12px"><strong>Quipx</strong></div>
											<span style="teaxt-align:left">
											<a href="quipx/home.php" class="textlink">Quipx</a> improves your group collaboration skills and results. You and your team members will increase efficiency, satisfaction, and communication. Based on extensive research in social, cognitive, and metacognitive processes using the CREATE platform, Quipx users develop or strengthen the expertise needed to understand, monitor, and regulate collaborative sense-making processes. And it does all this in an engaging and clear interface. <br /><br />"Discussions in (Quipx) made us push, made us uncomfortable, made us grow in ways that we typically don\'t engage." (Quipx team member)
											</span>
										</div>';
									}
									// help us grow
									if ($card == 5) {
										print '<div class="cardselect narrow" style="margin-left:-320px">
											<div style="float: right; padding: 4px;"><a href="about.php" class="textlink">close X</a></div>
											<br />
											<div style="text-align:center; margin-bottom:12px"><strong>Help Us Grow</strong></div>
											<span style="teaxt-align:left">
											We\'re a nonprofit corporation (IRS 501c3) and all tools are freely available. There\'s no advertising either. We run on grants, deductible monetary donations, and the effort of many people who contribute their time. Please share our links, and contact us for ways to participate or donate at info@thinkertools.org
											<br /><br />
											Please visit our <a href="https://thinkertools.org" class ="textlink">donation page</a> for more information.
											</span>
										</div>';
									}
								}
								else {
									if ($card == 1) echo $card1;
									if ($card == 2) echo $card2;
									if ($card == 3) echo $card3;
									if ($card == 4) echo $card4;
									if ($card == 5) echo $card5;
								}
							print '</div>';
						print '</div>';
						$card = $card + 1;
					}
					?>
				</div>
			</div>
		</div>
	</body>
</html>
