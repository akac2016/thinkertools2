<?php session_start();
	// logout clear session 
	if ($_GET['action'] == 'logout') session_unset(); 
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools home</title>
		<link rel="stylesheet" href="main.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="mainhead.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			<div class="column">
				<div class="columnhead red" style="margin-top: 12px;">
					<span class="columnheadtitle">Welcome to Thinkertools</span>
					<br />
					Free tools for building knowledge 
				</div>
				<div class="contentbox">
					We help you learn about what intrigues you. We help you build new knowledge that will benefit humankind and the planet. People want to connect with others to be a key part of our collective intelligence. We help you make those connections and collaborate effectively.
					<br /><br />
					We want Thinkertools and everyone who uses the tools to be part of something big. We don't think anyone would deny we live during a time with problems. Solving these problems and ensuring we don't cause new problems requires each of us to think, to understand, to reason, to question, but most importantly to help build new knowledge. Because without that, we're sunk.
					<br /><br />
					We also want Thinkertools to be part of something personally satisfying. We're an inquisitive species. We want to know why there's a universe, or what's the meaning of the novel I just read, or how does the brain rewire during isolation? All of us want to be part of a solution, or to solve a mystery. Thinkertools is a great place to start to satisfy your curiosity. 
					<br /><br />
					For more information see what's in <a href="about.php" class="textlink">About</a> and <a href="demos.php" class="textlink">Demos</a>. 
				</div>
				<div class="contentbox">
					<strong>Cookies, Privacy, Data, Terms of Use</strong><br />
					We don't collect cookies other than your login for use during a session. No personal data is sold or provided to any other entity. For more information on our policies, <a href="https://thinkertools.org/policies.html" class="textlink" target="_blank">go to our policies page</a>. 
				</div>
			</div>
			<div class="column">
				<?php 
				if (!isset($_SESSION['userID'])) {
					print '<div class="columnhead" style="padding:22px; margin-bottom:24px;">
						<a href="login.php" class="toollink"><span style="color:#C63232; font-size:24px">Log in to get started</span></a>
					</div>';
				}
				else {
					print '<div class="columnhead" style="padding:22px; margin-bottom:24px;">
						 <div class="columntitle" style="color:#C63232; font-size:24px">Platforms and status</div>
					</div>';
				}
				?>
				<div class="toolbox woi">
					<a href="webofinquiry/home.php" class="toollink">Web of Inquiry</a>
				</div>
				<div style="width: 100%; margin-top: 8px; background-color: white; border: none; display: inline-block;"> 
					<!-- WoI -->
					<div style="float: left;">
						<a href="webofinquiry/home.php" style="outline: none;"><img src="images/grid_screenshot.png" alt="grid_screenshot.png" width="240px" /></a>
					</div>
					<div style="float: left; margin-left: 12px;">
						<?php
						require "webofinquiry/woidb.php";
						// public games
						$getGames = "SELECT game_id FROM game WHERE game_public=1";
						$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
						echo count($games); print ' public inquiry games played<br />';
						// private games
						$getGames = "SELECT game_id FROM game WHERE game_public=0";
						$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
						echo count($games); print ' private inquiry games in play<br /><br />'; 
						// public templates
						$getGames = "SELECT template_id FROM template WHERE template_public=1";
						$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
						echo count($games); print ' games available in all categories<br />';
						// structual
						$getGames = "SELECT template_id FROM template WHERE template_public=1 AND template_category='structural' ";
						$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
						echo count($games); print ' structural games <br />';
						// functional
						$getGames = "SELECT template_id FROM template WHERE template_public=1 AND template_category='functional' ";
						$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
						echo count($games); print ' functional games <br />';
						// process
						$getGames = "SELECT template_id FROM template WHERE template_public=1 AND template_category='process' ";
						$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
						echo count($games); print ' process games <br />';
						?>
					</div>
				</div>
				<!-- Quipx -->
				<div class="toolbox quipx">
					<a href="quipx/home.php" class="toollink">Quipx</a>
				</div>
				<div style="width: 100%; margin-top: 8px; background-color: white; border: none; display: inline-block;">
					<div style="float: left;">
						<a href="quipx/home.php" style="outline: none;"><img src="images/session_screenshot.png" alt="session_screenshot.png" width="240px" /></a>
					</div>
					<div style="float: left; margin-left: 16px;">
						<?php
						require "quipx/qxdb.php";
						// sessions
						$getSessions = "SELECT sessionID FROM session";
						$sessions = $mysqli->execute_query($getSessions)->fetch_all(MYSQLI_ASSOC);
						echo count($sessions); print ' Quipx sessions<br /><br />';
						// entries
						$getSessions = "SELECT discussID FROM session_discuss";
						$sessions = $mysqli->execute_query($getSessions)->fetch_all(MYSQLI_ASSOC);
						echo count($sessions); print ' discussion entries<br />';
						// reflections
						$getSessions = "SELECT reflectSelectID FROM reflect_select";
						$sessions = $mysqli->execute_query($getSessions)->fetch_all(MYSQLI_ASSOC);
						echo count($sessions); print ' discussion reflections<br />';
						?>
					</div>
				</div>
			</div>
		</div>
	</body>
</html>
