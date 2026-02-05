<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// quipx db
	// require('qxdb.php');
	// initialize check variables
	$sessioncheck = 0;
	$teamcheck = 0;
	// check if getsessionID is set, set sessionID
	if (isset($_GET['sessionID'])) $_SESSION['sessionID'] = $_GET['sessionID'];
	if (isset($_SESSION['sessionID']) && isset($_SESSION['userID'])) $sessioncheck = 1;
	if ($sessioncheck == 1) {
		// check if user is on team
		require('qxdb.php');
		$getTeam = "SELECT teamID FROM session WHERE sessionID=?";
		$team = $mysqli->execute_query($getTeam, [$_SESSION['sessionID']])->fetch_assoc();
		require('../accountsdb.php');
		$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
		$mem = $mysqli->execute_query($checkTeamMem, [$team['teamID'], $_SESSION['userID']])->fetch_assoc();
		if (!empty($mem)) {
			$teamcheck = 1;
	 	}
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Quipx improve</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="qx.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="../mainhead.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			<div class="qlogodiv">
				<a href="home.php" class="qlogo">Quipx</a>
			</div>
			<div class="sessionnavdiv">
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle done"></div>
					Discuss
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle done"></div>
					Reflect
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle current"></div>
					Improve
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle next"></div>
					Review
				</div>
				<?php 
					$loc = "'review.php'" ;
					print ' <button class="button150 finishmargin" style="margin-left: 170px" onclick="window.location.href='.$loc.';">Finish improve</button>';
				?>
			</div>
			<?php
				if (isset($_SESSION['userID']) && $teamcheck == 1  && $sessioncheck == 1) {
					for($counter = 1; $counter <= 9; $counter++) {
						if ($counter < 7) {
							require('qxdb.php');
							$getReflectItem = "SELECT reflectItemID, reflectItem FROM reflect_item WHERE reflectItemOrder=?";
							$reflectItem = $mysqli->execute_query($getReflectItem, [$counter])->fetch_assoc();
							print '<div class="contentbox quipxborder" style="width:310px; height: 360px; margin-left:24px; display: inline-block; overflow-y:auto;">'; 
							print '<div class="contentboxtitle">'; echo stripslashes($reflectItem['reflectItem']); print '</div>';
							//initialize stats
							$order = 0;
							$selectTotal = 0;
							$selectMean = 0;
							$high = 0;
							$low = 0;
							// get the team members' selections
							$getSelect = "SELECT reflectSelect FROM reflect_select WHERE sessionID=? AND reflectItemID=?";
							$selects = $mysqli->execute_query($getSelect, [$_SESSION['sessionID'], $reflectItem['reflectItemID']])->fetch_all(MYSQLI_ASSOC);
							$countselects = count($selects);
							// check if any ratings
							if ($countselects > 0) {
								foreach ($selects as $key => $select) {
									$selectTotal = $selectTotal + $select['reflectSelect'];
									if ($high == 0) { 
										$high = $select['reflectSelect'];
									}
									else {
										if ($select['reflectSelect'] > $high) {
											$high = $select['reflectSelect'];
										}
									}
									if ($low == 0) { 
										$low = $select['reflectSelect'];
									}
									else {
										if ($select['reflectSelect'] < $low) {
											$low = $select['reflectSelect'];
										}
									}
								}	
								$order = round($selectTotal/$countselects);
								$selectMean = round($selectTotal/$countselects,1);
								print '<div style="text-align:center; font-size:18px; padding-top:12px">'; 
									print '<strong>'; echo $selectMean; print '</strong><br />average<br />';
									echo $high; print ' high '; echo $low; print ' low'; 
								print '<br /><br /></div>';
								$getResponseID = $mysqli->query("SELECT reflectResponseID FROM reflect_response WHERE reflectItemID=".$reflectItem['reflectItemID']." AND reflectResponseOrder=".$order."");
								if ($getResponseID->num_rows > 0) {
									while ($responseID_row = $getResponseID->fetch_array()) {
										$reflectResponseID = $responseID_row['reflectResponseID'];
										$getStrategy = $mysqli->query("SELECT strategy FROM improve_strategy WHERE reflectResponseID=".$reflectResponseID."");
										if ($getStrategy->num_rows > 0) {
											while ($strategy_row = $getStrategy->fetch_array()) {
												$strategy = stripslashes($strategy_row['strategy']);
												echo $strategy; print '<br />';
											}
										}
									}
								}
							}
							// no ratings
							else print '<br>no ratings';
							print '</div>';
						}
						elseif ($counter == 8) { 
							$lastorder = 7;
							require('qxdb.php');
							$getReflectItem = "SELECT reflectItemID, reflectItem FROM reflect_item WHERE reflectItemOrder=?";
							$reflectItem = $mysqli->execute_query($getReflectItem, [$lastorder])->fetch_assoc();
							print '<div class="contentbox quipxborder" style="width:310px; height: 360px; margin-left:24px; display: inline-block; overflow-y:auto;">'; 
							print '<div class="contentboxtitle">'; echo stripslashes($reflectItem['reflectItem']); print '</div>';
							//initialize stats
							$order = 0;
							$selectTotal = 0;
							$selectMean = 0;
							$high = 0;
							$low = 0;
							// get the team members' selections
							$getSelect = "SELECT reflectSelect FROM reflect_select WHERE sessionID=? AND reflectItemID=?";
							$selects = $mysqli->execute_query($getSelect, [$_SESSION['sessionID'], $reflectItem['reflectItemID']])->fetch_all(MYSQLI_ASSOC);
							$countselects = count($selects);
							// check if any ratings
							if ($countselects > 0) {
								foreach ($selects as $key => $select) {
									$selectTotal = $selectTotal + $select['reflectSelect'];
									if ($high == 0) { 
										$high = $select['reflectSelect'];
									}
									else {
										if ($select['reflectSelect'] > $high) {
											$high = $select['reflectSelect'];
										}
									}
									if ($low == 0) { 
										$low = $select['reflectSelect'];
									}
									else {
										if ($select['reflectSelect'] < $low) {
											$low = $select['reflectSelect'];
										}
									}
								}	
								$order = round($selectTotal/$countselects);
								$selectMean = round($selectTotal/$countselects,1);
								print '<div style="text-align:center; font-size:18px; padding-top:12px">'; 
									print '<strong>'; echo $selectMean; print '</strong><br />average<br />';
									echo $high; print ' high '; echo $low; print ' low'; 
								print '<br /><br /></div>';
								$getResponseID = $mysqli->query("SELECT reflectResponseID FROM reflect_response WHERE reflectItemID=".$reflectItem['reflectItemID']." AND reflectResponseOrder=".$order."");
								if ($getResponseID->num_rows > 0) {
									while ($responseID_row = $getResponseID->fetch_array()) {
										$reflectResponseID = $responseID_row['reflectResponseID'];
										$getStrategy = $mysqli->query("SELECT strategy FROM improve_strategy WHERE reflectResponseID=".$reflectResponseID."");
										if ($getStrategy->num_rows > 0) {
											while ($strategy_row = $getStrategy->fetch_array()) {
												$strategy = stripslashes($strategy_row['strategy']);
												echo $strategy; print '<br />';
											}
										}
									}
								}
							}
							// no ratings
							else print '<br>no ratings';
							print '</div>';
						}
						else {
							if ($counter == 9) {
								// finish button right cell
								$loc = "'review.php'" ;
								print '<div class="contentbox blank" style="width:310px; height: 360px; margin-left:24px; display: inline-block; overflow-y:auto;"> 
								<div class="contentboxtitle"><button class="button150" style="margin-left:48px; margin-top:320px" onclick="window.location.href='.$loc.';">Finish improve</button></div>
								</div>';
							}
							else {
								// blank left cell
								print '<div class="contentbox blank" style="width:310px; height: 360px; margin-left:24px; display: inline-block; overflow-y:auto;">'; 
								print '<div class="contentboxtitle">'; print '&nbsp;'; print '</div>';
								print '</div>';
							}
						}
					}
				}
			?>
		</div>
	</body>
</html>
