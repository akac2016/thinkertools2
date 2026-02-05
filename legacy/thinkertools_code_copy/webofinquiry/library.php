<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// quipx db
	// require('woidb.php');	
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Web of Inquiry library resources</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="woi.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="../mainhead.css" content="text/html; charset=utf-8"/>
		<!-- style cards -->
		<style>
			.libheader {
				margin-top: 24px; margin-left: 420px; width: 360px; height: 40px; background-color: #E2E54D; border: 1px solid black; padding-top: 12px; font-size: 24px; text-align: center;
			}
			.cardrow {
				width: 1200px; margin-top: 24px; margin-bottom: 24px;
			}
			.cardspace {
				float: left; width: 240px; padding-top: 36px;
			}
			.cardhr {
				border: 1px solid #E5D64D;
			}
			.cardvr {
				margin-top: -8px; margin-left: 115px; width: 1px; height: 60px; border: .5px solid #E5D64D; background-color: #E5D64D;
			}
			.cardcircle {
				margin-left: 95px; margin-top: -80px; width: 36px; height: 36px; border: 2px solid #E5D64D; background-color: #F5F5F5; border-radius: 50%; clear: both;
			}
			.card {
				width: 200px; height: 250px; margin-left: 8px; margin-top: 30px; padding: 6px; background-color: white; border: 1px solid #E5D64D; line-height: 24px; text-align: center;
			}
			.cardselect {
				width: 820px; margin-left: -320px; margin-top: -24px; margin-bottom: 12px; padding-left:12px; padding-bottom:12px; padding-right:12px; background-color: white; border: 1px solid #E5D64D; text-align:left; position: absolute; z-index: 1;
			}
			.narrow {
				width: 520px; margin-left: -180px;
			}
		</style>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			<div class="woilogodiv">
				<a href="home.php" class="woilogo">Web of Inquiry</a>
			</div>
			<div style="width: 1200px;">
				<div class="libheader">
					Library and Resources
				</div>
			</div>
			<div class="cardrow">
				<?php
				$select = 0;
				if (isset($_GET['select'])) $select = $_GET['select'];
				$card1 = "<strong>Games by Domain:Subject</strong><br /><br />sciences, mathematics, engineering, technology, arts, and more<br /><br /><a href='library.php?select=1' class='textlink'>view</a>";
				$card2 = "<strong>Games by Category<br />List</strong><br /><br />structural, functional, and process games<br /><br /><a href='library.php?select=2' class='textlink'>view</a>";
				$card3 = "<strong>Games by Category<br />Chart</strong><br /><br />structural, functional, and process games<br /><br /><a href='library.php?select=3' class='textlink'>view</a>";
				$card4 = "<strong>Game Elements</strong><br /><br />description, object, rules, moves, levels, public<br /><br /><a href='library.php?select=4' class='textlink'>view</a>";
				$card5 = "<strong>Other Resources</strong><br /><br />support, faqs, demos, articles, and others<br /><br /><a href='library.php?select=5' class='textlink'>view</a>";
				$card = 1;
				while ($card<6) {
					print '
					<div class="cardspace">';
						print '<hr class="cardhr">';
						print '<div class="cardvr"></div>';
						if ($select == $card) print '<div class="cardcircle" style="background-color: #E2E54D;"></div>';
						else print '<div class="cardcircle"></div>';
						print '<div class="card">';
							if ($select == $card) {
								// subjects 
								if ($card == 1) {
									if (!isset($_GET['template_id'])) {
										print '<div class="cardselect narrow" style="margin-left:-12px">
											<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
											<br />';
											print '<div style="text-align:center; margin-bottom:12px"><strong>Games by Subjects</strong></div>';
											require "woidb.php";
											$getSubjects = "SELECT subjectID, domain, subject FROM subject ORDER BY domain, subject";
											$subjects = $mysqli->execute_query($getSubjects)->fetch_all(MYSQLI_ASSOC);
											foreach($subjects as $subject_key => $subject) {
												$subjectID = $subject['subjectID'];
												$subjectDomain = stripslashes($subject['domain']);
												$subjectName = stripslashes($subject['subject']);
												print '<strong>'; echo $subjectDomain; print ': ';
												echo $subjectName; print '</strong><br />';
												$getTemplateIDs = "SELECT template_id FROM template_subject WHERE subjectID=?";
												$templateIDs = $mysqli->execute_query($getTemplateIDs, [$subjectID])->fetch_all(MYSQLI_ASSOC);
												foreach($templateIDs as $templateID_key => $templateID) {
													$template_id = $templateID['template_id'];
													$getTemplate = "SELECT template_name, template_public FROM template WHERE template_id=?";
													$templateName = $mysqli->execute_query($getTemplate, [$template_id])->fetch_assoc();
													if ($templateName['template_public'] == 1) {
														$template_name = stripslashes($templateName['template_name']);
														print '<a href="library.php?select=1&template_id='.$template_id.'" class="textlink">'.$template_name.'</a><br />';
													}
												}
												print '<br />';
											}
										print '</div>';
									}
									else {
										print '<div class="cardselect narrow" style="margin-left:-12px">
											<div style="float: left; padding: 4px;"><a href="library.php?select=1" class="textlink">< back</a></div>
											<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
											<br /><br />';
											require "woidb.php";
											$getTemplate = "SELECT * FROM template WHERE template_id=? ";
											$template = $mysqli->execute_query($getTemplate, [$_GET['template_id']])->fetch_assoc();
											$template_name = stripslashes($template['template_name']);
											$template_object = stripslashes($template['template_object']);
									  		print '<strong>Inquiry game name</strong><br />';
									  		echo $template_name; print '<br /><br />';
									  		print '<strong>Object or form</strong><br />'; 
									  		echo $template_object; print '<br /><br />';
									  		// rules
									  		print '<strong>Rules</strong><br />';
									  		$getRules = "SELECT rule, rule_order FROM template_rule WHERE template_id=? AND rule !=''";
											$rules = $mysqli->execute_query($getRules, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
											foreach($rules as $rule_key => $rule) {
												echo $rule['rule_order']; print '. ';
												echo stripslashes($rule['rule']); print '<br />';
											}
											print '<br />';
											// moves
									  		print '<strong>Moves</strong><br />';
									  		$getMoves = "SELECT move, move_order FROM template_move WHERE template_id=? AND move !=''";
											$moves = $mysqli->execute_query($getMoves, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
											foreach($moves as $move_key => $move) {
												echo $move['move_order']; print '. ';
												echo stripslashes($move['move']); print '<br />';
											}
											print '<br />';
											// levels
											$getLevels = "SELECT level_name, level_order FROM template_level WHERE template_id=? AND level_name<>''";
											$levels = $mysqli->execute_query($getLevels, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
											if (count($levels) > 0) {
												print '<strong>Levels</strong><br />';
												foreach($levels as $level_key => $level) {
										  			echo $level['level_order']; print '. ';
										  			echo stripslashes($level['level_name']); print '<br />';
										  		}
										  	}
										print '</div>';
									}
								}
								// category list 
								if ($card == 2) {
									if (!isset($_GET['template_id'])) {
										print '<div class="cardselect narrow">
											<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
											<br />
											<div style="text-align:center; margin-bottom:12px"><strong>Games by Categories</strong></div>
											<strong>Structural games</strong><br />';
											require "woidb.php";
											$template_category = "structural";
											$getTemplates = "SELECT template_id, template_name FROM template WHERE template_category=? AND template_public=1 ORDER BY template_name";
											$templates = $mysqli->execute_query($getTemplates, [$template_category])->fetch_all(MYSQLI_ASSOC);
											foreach($templates as $template_key => $template) {
												$template_id = $template['template_id'];
												$template_name = stripslashes($template['template_name']);
												print '<a href="library.php?select=2&template_id='.$template_id.'" class="textlink">'.$template_name.'</a><br />';
											}
											print '<br />
											<strong>Functional games</strong><br />';
											require "woidb.php";
											$template_category = "functional";
											$getTemplates = "SELECT template_id, template_name FROM template WHERE template_category=? AND template_public=1 ORDER BY template_name";
											$templates = $mysqli->execute_query($getTemplates, [$template_category])->fetch_all(MYSQLI_ASSOC);
											foreach($templates as $template_key => $template) {
												$template_id = $template['template_id'];
												$template_name = stripslashes($template['template_name']);
												print '<a href="library.php?select=2&template_id='.$template_id.'" class="textlink">'.$template_name.'</a><br />';
											}
											print '<br />
											<strong>Process games</strong><br />';
											require "woidb.php";
											$template_category = "process";
											$getTemplates = "SELECT template_id, template_name FROM template WHERE template_category=? AND template_public=1 ORDER BY template_name";
											$templates = $mysqli->execute_query($getTemplates, [$template_category])->fetch_all(MYSQLI_ASSOC);
											foreach($templates as $template_key => $template) {
												$template_id = $template['template_id'];
												$template_name = stripslashes($template['template_name']);
												print '<a href="library.php?select=2&template_id='.$template_id.'" class="textlink">'.$template_name.'</a><br />';
											}
										print '</div>';
									}
									else {
										print '<div class="cardselect narrow">
											<div style="float: left; padding: 4px;"><a href="library.php?select=2" class="textlink">< back</a></div>
											<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
											<br /><br />';
											require "woidb.php";
											$getTemplate = "SELECT * FROM template WHERE template_id=? ";
											$template = $mysqli->execute_query($getTemplate, [$_GET['template_id']])->fetch_assoc();
											$template_name = stripslashes($template['template_name']);
											$template_object = stripslashes($template['template_object']);
									  		print '<strong>Inquiry game name</strong><br />';
									  		echo $template_name; print '<br /><br />';
									  		print '<strong>Object or form</strong><br />'; 
									  		echo $template_object; print '<br /><br />';
									  		// rules
									  		print '<strong>Rules</strong><br />';
									  		$getRules = "SELECT rule, rule_order FROM template_rule WHERE template_id=? AND rule !=''";
											$rules = $mysqli->execute_query($getRules, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
											foreach($rules as $rule_key => $rule) {
												echo $rule['rule_order']; print '. ';
												echo stripslashes($rule['rule']); print '<br />';
											}
											print '<br />';
											// moves
									  		print '<strong>Moves</strong><br />';
									  		$getMoves = "SELECT move, move_order FROM template_move WHERE template_id=? AND move !=''";
											$moves = $mysqli->execute_query($getMoves, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
											foreach($moves as $move_key => $move) {
												echo $move['move_order']; print '. ';
												echo stripslashes($move['move']); print '<br />';
											}
											print '<br />';
											// levels
											$getLevels = "SELECT level_name, level_order FROM template_level WHERE template_id=? AND level_name<>''";
											$levels = $mysqli->execute_query($getLevels, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
											if (count($levels) > 0) {
												print '<strong>Levels</strong><br />';
												foreach($levels as $level_key => $level) {
										  			echo $level['level_order']; print '. ';
										  			echo stripslashes($level['level_name']); print '<br />';
										  		}
										  	}
										print '</div>';
									}
								}
								// category chart 
								if ($card == 3) {
									print '<div class="cardselect">
										<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
										<br />
										<div style="text-align:center; margin-bottom:12px"><strong>Game Categories and Examples</strong></div>';
										require "woidb.php";
										$getChart = $mysqli->query("SELECT * FROM chart");
										if ($getChart->num_rows > 0) {
										  	while ($chart_row = $getChart->fetch_array()) {
										  		if ($chart_row['rowID'] == 1) {
										  			$r1c1 = stripslashes($chart_row['col1']);
										  			$r1c2 = stripslashes($chart_row['col2']);
										  			$r1c3 = stripslashes($chart_row['col3']);
										  			$r1c4 = stripslashes($chart_row['col4']);
										  		}
										  		if ($chart_row['rowID'] == 2) {
										  			$r2c1 = stripslashes($chart_row['col1']);
										  			$r2c2 = stripslashes($chart_row['col2']);
										  			$r2c3 = stripslashes($chart_row['col3']);
										  			$r2c4 = stripslashes($chart_row['col4']);
										  		}
										  		if ($chart_row['rowID'] == 3) {
										  			$r3c1 = stripslashes($chart_row['col1']);
										  			$r3c2 = stripslashes($chart_row['col2']);
										  			$r3c3 = stripslashes($chart_row['col3']);
										  			$r3c4 = stripslashes($chart_row['col4']);
										  		}
										  		if ($chart_row['rowID'] == 4) {
										  			$r4c1 = stripslashes($chart_row['col1']);
										  			$r4c2 = stripslashes($chart_row['col2']);
										  			$r4c3 = stripslashes($chart_row['col3']);
										  			$r4c4 = stripslashes($chart_row['col4']);
										  		}
										  		if ($chart_row['rowID'] == 5) {
										  			$r5c1 = stripslashes($chart_row['col1']);
										  			$r5c2 = stripslashes($chart_row['col2']);
										  			$r5c3 = stripslashes($chart_row['col3']);
										  			$r5c4 = stripslashes($chart_row['col4']);
										  		}
										  		if ($chart_row['rowID'] == 6) {
										  			$r6c1 = stripslashes($chart_row['col1']);
										  			$r6c2 = stripslashes($chart_row['col2']);
										  			$r6c3 = stripslashes($chart_row['col3']);
										  			$r6c4 = stripslashes($chart_row['col4']);
										  		}
										  	}
										}
										print ' 
										<div style="display: table; width: 100%; font-weight:bold;">
											<div style="display: table-cell; width: 16%; border: 1px solid #E5D64D; padding:4px;">
												&nbsp;
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												Structural
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												Functional
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												Process
											</div>
										</div>
										<div style="display: table; width: 100%; margin-top:-1px;">
											<div style="display: table-cell; width: 16%; border: 1px solid #E5D64D; padding:4px; font-weight:bold;">
												'.$r1c1.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r1c2.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r1c3.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r1c4.'
											</div>
										</div>
										<div style="display: table; width: 100%; margin-top:-1px;">
											<div style="display: table-cell; width: 16%; border: 1px solid #E5D64D; padding:4px; font-weight:bold;">
												'.$r2c1.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r2c2.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r2c3.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r2c4.'
											</div>
										</div>
										<div style="display: table; width: 100%; margin-top:-1px;">
											<div style="display: table-cell; width: 16%; border: 1px solid #E5D64D; padding:4px; font-weight:bold;">
												'.$r3c1.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r3c2.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r3c3.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r3c4.'
											</div>
										</div>
										<div style="display: table; width: 100%; margin-top:-1px;">
											<div style="display: table-cell; width: 16%; border: 1px solid #E5D64D; padding:4px; font-weight:bold;">
												'.$r4c1.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r4c2.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r4c3.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r4c4.'
											</div>
										</div>
										<div style="display: table; width: 100%; margin-top:-1px;">
											<div style="display: table-cell; width: 16%; border: 1px solid #E5D64D; padding:4px; font-weight:bold;">
												'.$r5c1.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r5c2.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r5c3.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r5c4.'
											</div>
										</div>
										<div style="display: table; width: 100%; margin-top:-1px;">
											<div style="display: table-cell; width: 16%; border: 1px solid #E5D64D; padding:4px; font-weight:bold;">
												'.$r6c1.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r6c2.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r6c3.'
											</div>
											<div style="display: table-cell; width: 28%; border: 1px solid #E5D64D; padding:4px;">
												'.$r6c4.'
											</div>
										</div>
									</div>';
								}
								// elements 
								if ($card == 4) {
									if (!isset($_GET['element'])) {
										print '<div class="cardselect narrow">
											<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
											<br />
											<div style="text-align:center; margin-bottom:12px; padding-left:48px;"><strong>Game Elements</strong></div>
											<div style="text-align:center;">
											<a href="library.php?select=4&element=name" class="textlink">Name</a><br />
											<a href="library.php?select=4&element=name" class="textlink">Object</a><br /><br />
											<a href="library.php?select=4&element=rules" class="textlink">Rules</a><br />
											<a href="library.php?select=4&element=moves" class="textlink">Moves</a><br />
											<a href="library.php?select=4&element=levels" class="textlink">Levels</a><br /><br />
											<a href="library.php?select=4&element=public" class="textlink">Public</a><br />
											</div>
										</div>';
									}
									else {
										print '<div class="cardselect narrow">
											<div style="float: left; padding: 4px;"><a href="library.php?select=4" class="textlink">< back</a></div>
											<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
											<br /><br />';
											if ($_GET['element'] == "name") {
												print '<strong>Game name</strong><br />
												The name is a concise description of the game. It should be related to the object or form of the game. 
												<br /><br />
												<strong>Game object</strong><br />
												The object of a game is the final form after all the turns are taken. It is the end point of the game, and should be sufficient to answer your inquiry question and similar questions. 
												';
											}
											if ($_GET['element'] == "rules") {
												print '<strong>Game rules</strong><br />
												The rules are the definitions of what makes a game different from other games. They are the constraints on what moves can be taken in the game. <br /><br />
												Rules should be concise and different from each other. As a set of rules, they should fully define the game. 
												<br /> 
												';
											}
											if ($_GET['element'] == "moves") {
												print '<strong>Game moves</strong><br />
												The moves are the actions can be performed by a team member to complete the game. <br /><br />
												Moves should be concise and different from each other. As a set of moves, they should be complete as allowed by the game rules. 
												<br /> 
												';
											}
											if ($_GET['element'] == "levels") {
												print '<strong>Game levels</strong><br />
												The levels divide a game into steps that are usually completed sequentially. They help move the team toward completing the game form.<br /><br />
												Levels should be concise and different from each other. As a set of levels, they should be complete as allowed by the game rules. 
												<br /> 
												';
											}
											if ($_GET['element'] == "public") {
												print '<strong>Public</strong><br />
												A game can be public or private. Generally, a private game is one that is in play or under development. <br /><br />
												When a game is finished, the game manager should make it a public game. This allows the results to be part of the Web of Inquiry. And others will be able to use the game you created to answer their similar and relevant inquiry questions. 
												<br /> 
												';
											}
										print '</div>';
									}
								}
								// other resources
								if ($card == 5) {
									print '<div class="cardselect narrow" style="margin-left:-320px">
										<div style="float: right; padding: 4px;"><a href="library.php" class="textlink">close X</a></div>
										<br />
										<div style="text-align:center; margin-bottom:12px"><strong>Other Resources</strong></div>
										Our <a href="../support.php?action=woi" class="textlink">FAQs</a> might help with your questions.<br /><br />
										Check out our <a href="../demos.php" class="textlink">Demos</a> for step-by-step instructions.<br /><br />
										The Web of Inquiry elements are based on the work of several researchers. Two of the main publications are: <br /><br /> 
										Epistemic Forms and Epistgemic Games: Structures and Strategies to Guide Inquiry (Collins and Ferguson, 1993)
										<a href="https://drive.google.com/file/d/1i3sLvbtRy0POZ73INYm0IQq82aJ6kQHo/view?usp=sharing" class="textlink" target="_blank">view or download</a><br /><br />
										The Web of Inquiry: Computer Support for Playing Epistgemic Games (Shimoda and Borge, 2016) <a href="https://drive.google.com/file/d/1AD0LgEhpitKJVf3-L04SBXJnzthfT0IE/view?usp=sharing" class="textlink" target="_blank">view or download</a>
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
						print '</div>
					</div>';
					$card = $card + 1;
				}
				?>
			</div>
		</div>
	</body>
</html>