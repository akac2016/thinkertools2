<?php session_start();
	// teacher check
	$teachercheck = 0;
	require('accountsdb.php');
	$getUser = "SELECT teacher FROM ttuser WHERE userID=?";
	$user = $mysqli->execute_query($getUser, [$_SESSION['userID']])->fetch_assoc();
	if ($user['teacher']==1) $teachercheck = 1; 
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools experience</title>
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
				if ($teachercheck == 1) {
					print '<div class="toolbox woi" style="margin-left:300px; margin-bottom:18px; background-color: #C63232; color: white; clear:both;">
					<a href="teacher.php" class="toollink">Teacher Page</a>
					</div>';
				}
			?>
			<div class="column">
				<!-- WoI -->
				<div class="toolbox woi">
					<a href="webofinquiry/home.php" class="toollink">Web of Inquiry</a>
				</div>
				<div class="contentbox">
					<?php 
					if (isset($_SESSION['userID'])) {
						$loc1 = "'webofinquiry/design.php'";
						$loc2 = "'webofinquiry/play.php'";
						print ' 
						Create an inquiry game to solve a mystery, satisfy your curiosity.
						<br /><br />
						<button class="button150" onclick="window.location.href='.$loc1.';">Design a game</button>
						<br /><br /><br />
						Search and join an inquiry game, or take your turn in one of your games.
						<br /><br />
						<button class="button150" onclick="window.location.href='.$loc2.';">Play a game</button>
						<br /><br />
						';
					}
					else {
						print '
						Create an inquiry game to solve a mystery, satisfy your curiosity.<br />
						Search and join an inquiry game, or take your turn in one of your games. <br /><br />
						<div style="text-align: center"><a href="login.php" class="textlink">Log in here</a></div>
						';
					}
					?>
				</div>
			</div>
			<!-- Quipx -->
			<div class="column">
				<div class="toolbox quipx">
					<a href="quipx/home.php" class="toollink">Quipx</a>
				</div>
				<div class="contentbox">
					<?php 
					if (isset($_SESSION['userID'])) {
						$loc3 = "'quipx/create.php?action=new'";
						$loc4 = "'quipx/home.php'";
						print ' 
						Plan and start a session to help improve team collaboration.
						<br /><br />
						<button class="button150" onclick="window.location.href='.$loc3.';">Create a session</button>
						<br /><br /><br />
						Join a session ready to start or one already in progress.
						<br /><br />
						<button class="button150" onclick="window.location.href='.$loc4.';">Join a session</button>
						<br /><br />
						';
					}
					else {
						print '
						Plan and start a session to help improve team collaboration.<br />
						Join a session ready to start or one already in progress.<br /><br />
						<div style="text-align: center"><a href="login.php" class="textlink">Log in here</a></div>
						';
					}
					?>
				</div>
			</div>
		</div>
	</body>
</html>
