<?php session_start();
	// user account db
	require('accountsdb.php');
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools teams</title>
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
				if (isset($_SESSION['userID']) && !isset($_GET['action'])) {
					print '<div class="columnhead red" style="margin-left:350px;">
						<span class="columnheadtitle">
						 Organizations + Teams
						</span>
					</div>
					<div class="column">
						<div class="contentbox">
							<div class="contentboxtitle">Organizations you manage</div>
							<div style="float:right"><button class="button150" onclick="window.location.href=\'teams.php?action=orgnew\';">New Organization</button></div>
							<br />
							Click on an organization to modify. 
							<br />
							Organizations can have multiple teams.
							<br /><br />';
							$getOrgs = $mysqli->query("SELECT * FROM ttorg WHERE userID=".$_SESSION['userID']."");
							if ($getOrgs->num_rows > 0) {
								while ($orgsrow = $getOrgs->fetch_array()) {
									print '<a href="teams.php?action=orgedit&orgID='.$orgsrow['orgID'].'" class="textlink">';
									echo stripslashes($orgsrow['orgName']);
									print '</a><br />';
								}
							}
							print '
						</div>
						<div class="contentbox">
							<div class="contentboxtitle">Organizations you are a member</div>';
							$getOrgs = $mysqli->query("SELECT orgID FROM ttorg_mem WHERE userID=".$_SESSION['userID']."");
							if ($getOrgs->num_rows > 0) {
								while ($orgsrow = $getOrgs->fetch_array()) {
									$getOrg = $mysqli->query("SELECT orgName FROM ttorg WHERE orgID=".$orgsrow['orgID']."");
									if ($getOrg->num_rows > 0) {
										while ($orgrow = $getOrg->fetch_array()) {
											echo stripslashes($orgrow['orgName']);
										}
									}
									print '<br />';
								}
							}
							print '
						</div>
					</div>
					<div class="column">
						<div class="contentbox">
							<div class="contentboxtitle">Teams you manage</div>
							<div style="float:right"><button class="button150" onclick="window.location.href=\'teams.php?action=teamnew\';">New Team</button></div>
							<br />
							Click on a team to modify. 
							<br /><br />';
							$getTeams = $mysqli->query("SELECT * FROM ttteam WHERE userID=".$_SESSION['userID']."");
							if ($getTeams->num_rows > 0) {
								while ($teamsrow = $getTeams->fetch_array()) {
									print '<a href="teams.php?action=teamedit&teamID='.$teamsrow['teamID'].'" class="textlink">';
									if ($teamsrow['teamName'] != "") echo stripslashes($teamsrow['teamName']);
									else {print 'TeamID '; echo $teamsrow['teamID'];}
									print '</a><br />';
								}
							}
							print '
						</div>
						<div class="contentbox">
							<div class="contentboxtitle">Teams you are a member</div>';
							$getTeams = $mysqli->query("SELECT teamID FROM ttteam_mem WHERE userID=".$_SESSION['userID']."");
							if ($getTeams->num_rows > 0) {
								while ($teamsrow = $getTeams->fetch_array()) {
									$getTeam = $mysqli->query("SELECT teamName FROM ttteam WHERE teamID=".$teamsrow['teamID']."");
									if ($getTeam->num_rows > 0) {
										while ($teamrow = $getTeam->fetch_array()) {
											echo stripslashes($teamrow['teamName']);
										}
									}
								print '<br />';
								}
							}
							print '
						</div>
					</div>
					'; 
				}
			?>
			
			<div class="column">
				<?php 
					if (isset($_SESSION['userID'])) {
						// organization ———————————————————————————
						if ($_GET['action'] == 'orgnew') {
							print '
							<form action="teams.php?action=orgnewcheck" method="post" class="form" onsubmit="disableButton()"> 
							<div class="fielddiv">
								<div class="fieldname">
									Name
								</div>
								<div class="fieldvalue">
									<input name="orgName" type="text" class="inputtext" maxlength="150" placeholder="organization name 150 chars max)" required />
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
								</div>
							</div>
					      	</form>';
						}
						elseif ($_GET['action'] == 'orgnewcheck') {
							$getOrg = "SELECT orgID FROM ttorg WHERE orgName =?";
		        			$orgcheck = $mysqli->execute_query($getOrg, [$_POST['orgName']])->fetch_assoc();
							if (!empty($orgcheck)) {
								// name is taken
								print '<br /><br />That organization name is already taken, please try another.';
							}
							else {
								// insert new org
								$startdate = date('Y-m-d H:i:s');
								$stmt = $mysqli->prepare("INSERT INTO ttorg (orgName, orgCreated, userID) VALUES (?,?,?)");
						  		$stmt->bind_param("ssi", $_POST['orgName'], $startdate, $_SESSION['userID']);
						  		$stmt->execute();
						  		$stmt->close();
						  		// get new org info after pause
						  		sleep(1);
						  		$getNewOrg = "SELECT orgID, orgName, userID FROM ttorg WHERE orgName=?";
						  		$org = $mysqli->execute_query($getNewOrg, [$_POST['orgName']])->fetch_assoc();
				  				// display the org name/ID and admin
						  		print '<div class="contentbox">
						  			<strong>Congrats, your organization is ready</strong><br />'; 
						  			echo stripslashes($org['orgName']); print '<br />';
						  			print 'Org ID - '; echo $org['orgID']; print '<br />';
							  		$getAdmin = "SELECT firstname, lastname FROM ttuser WHERE userID=?";
							  		$admin = $mysqli->execute_query($getAdmin, [$org['userID']])->fetch_assoc();
							  		print 'Org admin - ';
							  		echo stripslashes($admin['firstname']); print ' '; 
									echo stripslashes($admin['lastname']); print '<br /><br />';
							  		// org members
						  			print '
						  			<strong>Add members</strong><br />You can add your organization members with the link below. Or if you want us to add them, contact us for other options. If you aren\'t ready to add members, you can add them later by clicking the organization\'s link in "Organizations you manage".<br /><br />
						  			To add a member, you\'ll need to submit their Thinkertools username or email. If they already have a Thinkertools account, they\'ll be added to your organization automatically. If they don\'t have an account, you will have to contact them to set one up.<br /><br />
						  			<a href="teams.php?action=orgedit&orgID='.$org['orgID'].'" class="textlink">Add members </a>
						  		</div>';
						  		// insert admin into org_mem
						  		$orgID_mem = $org['orgID'];
						  		$orgUser_mem = $org['userID'];
								$stmt = $mysqli->prepare("INSERT INTO ttorg_mem (orgID, userID) VALUES (?,?)");
				  				$stmt->bind_param("ii", $orgID_mem, $orgUser_mem);
				  				$stmt->execute();
				  				$stmt->close();
							}
						}
						elseif ($_GET['action'] == 'orgedit') {
							$getOrg = "SELECT orgName, userID FROM ttorg WHERE orgID = ?";
							$org = $mysqli->execute_query($getOrg, [$_GET['orgID']])->fetch_assoc();	
							// check if $_SESSION['userID'] is org admin
							if ($org['userID'] != $_SESSION['userID']) {
								print '<br /><br />
								You must be the organization admin to edit';
							}
							else {
								print '<div class="contentbox blank">';
									// orgname and admin
									echo stripslashes($org['orgName']); print '<br />';
									print 'Admin - '; 
									$getAdmin = "SELECT firstname, lastname FROM ttuser WHERE userID =?";
									$admin = $mysqli->execute_query($getAdmin, [$org['userID']])->fetch_assoc();	
									echo stripslashes($admin['firstname']); print ' ';
									echo stripslashes($admin['lastname']);
									print '<br /><br />';
									// org name
									print '<form action="teams.php?action=orgupdate" method="post" onsubmit="disableButton()">
									<div class="fielddiv">
										<div class="fieldname">
											Name
										</div>
										<div class="fieldvalue">
											<input name="orgName" type="text" class="inputtext" maxlength="150" value="'.stripslashes($org['orgName']).'" placeholder="organization name (150 chars max)" required />
										</div>
									</div>
									';
									// view all members
									print 'Members <br />';
									$getOrgMem = "SELECT userID FROM ttorg_mem WHERE orgID =?";
									$orgmem = $mysqli->execute_query($getOrgMem, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
        							foreach ($orgmem as $mem) {
										$getUser = "SELECT username, firstname, lastname FROM ttuser WHERE userID =?";
										$user = $mysqli->execute_query($getUser, [$mem['userID']])->fetch_assoc();
										print '<input name="userID[]" type="checkbox" value='.$mem['userID'].' checked>';
										echo $user['username']; print ' (';
										echo $user['firstname']; print ' ';
										echo $user['lastname']; print ') <br />';
									}
									// new org member
						 			print '<br />
						 			Add a new org member (email or username) <br /><br />
									<div class="fielddiv">
										<div class="fieldname">
											New member
										</div>
										<div class="fieldvalue">
											<input name="newMem" type="text" class="inputtext" placeholder="email or username" />
										</div>
									</div>
									';
									print '<input type="hidden" name="orgID" value="'.$_GET['orgID'].'" />
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
										</div>
									</div>
									</form>';
									// print '<br />
									// <a href="teams.php?action=orgaddmem&orgID='.$_GET['orgID'].'" class="textlink">Add members manually</a><br /><br />';
								print '</div>';
							}
						}
						elseif ($_GET['action'] == 'orgupdate') {
							print '<div class="contentbox">';
								// check org name
								$getOrgName = "SELECT orgName FROM ttorg WHERE orgID =?";
			        			$orgname = $mysqli->execute_query($getOrgName, [$_POST['orgID']])->fetch_assoc(); 
								if ($orgname['orgName'] != $_POST['orgName']) {
									// check for unique
									$checkOrgName = "SELECT orgID FROM ttorg WHERE orgName =?";
			        				$orgcheck = $mysqli->execute_query($checkOrgName, [$_POST['orgName']])->fetch_assoc();
									if (!empty($orgcheck)) {
										// name is taken
										print 'That organization name is already taken, please try another.';
									}
									else {
										// update org name
						  				$stmt = $mysqli->prepare("UPDATE ttorg SET orgname=? WHERE orgID=?");
										$stmt->bind_param('si', $_POST['orgName'], $_POST['orgID']);
										$stmt->execute();
										$stmt->close();
										print 'Updated organization <br />';
										echo stripslashes($_POST['orgName']);
									}
								}
								else { 
									print 'Updated organization <br />';
									echo stripslashes($_POST['orgName']);
								}
								// org members update (delete only)
								$getOrgMem = "SELECT userID FROM ttorg_mem WHERE orgID =?";
								$orgmem = $mysqli->execute_query($getOrgMem, [$_POST['orgID']])->fetch_all(MYSQLI_ASSOC);
								foreach ($orgmem as $mem) {
									// admin must be a member
									if ($mem['userID'] != $_SESSION['userID']) {
										// check org status, delete if not in udpated list
							  			$orgmem_check = 0;
							  			$userID_check = $_POST['userID'];
										foreach ($userID_check as $member_check) {
											if ($member_check == $mem['userID']) $orgmem_check = 1;
										} 
										if ($orgmem_check == 0) { 
											$stmt = $mysqli->prepare("DELETE FROM ttorg_mem WHERE orgID=? AND userID=?");
			  								$stmt->bind_param("ii", $_POST['orgID'], $mem['userID']);
			  								$stmt->execute();
			  								$stmt->close();
			  							}
			  						}
								}
								// add new member
						  		if ($_POST['newMem'] != "") {
						  			$getUser = "SELECT userID FROM ttuser WHERE username =? OR email =?";
									$user = $mysqli->execute_query($getUser, [$_POST['newMem'], $_POST['newMem']])->fetch_assoc();
									if (!empty($user)) {
						  				// check if already on team
						  				$checkOrgMem = "SELECT userID FROM ttorg_mem WHERE orgID=? AND userID=?";
										$orgMem = $mysqli->execute_query($checkOrgMem, [$_POST['orgID'], $user['userID']])->fetch_assoc();
										if (empty($orgMem)) {
							  				// insert new member
							  				$stmt = $mysqli->prepare("INSERT INTO ttorg_mem (orgID, userID) VALUES (?,?)");
						  					$stmt->bind_param("ii", $_POST['orgID'], $user['userID']);
						  					$stmt->execute();
						  					$stmt->close();
						  					print '<br />New member added.';
						  				}
						  				else print '<br />New member is already in the organization.';
						  			}
						  			else {
						  				print '<br />Your requested new member doesn\'t have an account so can\'t be added to the organization. Please have them set up an account first.';
						  			}
						  		}
							print '</div>';
						}
						// team ——————————————————————————————————
						elseif ($_GET['action'] == 'teamnew') {
							print '<div class="contentbox blank">
								<form action="teams.php?action=teamnewinsert" method="post" class="form" onsubmit="disableButton()"> 
								<div class="fielddiv">
									<div class="fieldname">
										Name
									</div>
									<div class="fieldvalue">
										<input name="teamName" type="text" class="inputtext" maxlength="150" placeholder="team name 150 chars max" required />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Org
									</div>
									<div class="fieldvalue fieldvaluebox">
										Select your team\'s organization (if any)<br /><br />';
								    	// any user in an org can set up a team within that org
								    	$getOrgs = "SELECT orgID FROM ttorg_mem WHERE userID =?";
			        					$orgs = $mysqli->execute_query($getOrgs, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
										foreach ($orgs as $org) {
											$getOrgName = "SELECT orgName FROM ttorg WHERE orgID = ?";
											$orgName = $mysqli->execute_query($getOrgName, [$org['orgID']])->fetch_assoc();	
								    			print '<input name="orgID" type="radio" value="'.$org['orgID'].'">';
												echo stripslashes($orgName['orgName']); print '<br />';
								    	}
										print '<br /><input name="orgID" type="radio" value="0"> None, stand alone team<br />						
									</div>
								</div>
					      		<div class="fielddiv"">
									<div class="fieldname">
									
									</div>
									<div class="fieldvalue">
										<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
									</div>
								</div>
								</form>
				      		</div>';
						}
						elseif ($_GET['action'] == 'teamnewinsert') {
							$startdate = date('Y-m-d H:i:s');
							$stmt = $mysqli->prepare("INSERT INTO ttteam (orgID, teamName, teamCreated, userID) VALUES (?,?,?,?)");
						  	$stmt->bind_param("issi", $_POST['orgID'], $_POST['teamName'], $startdate, $_SESSION['userID']);
						  	$stmt->execute();
						  	$stmt->close();
						  	sleep(1);
						  	// get new teamID
						  	$getNewTeam = "SELECT teamID, teamName FROM ttteam WHERE userID=? AND teamCreated=?";
						  	$team = $mysqli->execute_query($getNewTeam, [$_SESSION['userID'], $startdate])->fetch_assoc();
						  	// insert admin into team
							$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
			  				$stmt->bind_param("ii", $team['teamID'], $_SESSION['userID']);
			  				$stmt->execute();
			  				$stmt->close();
				  			// print team name
							print '<div class="contentbox">';
					  			echo stripslashes($team['teamName']);
					  			print ' has been added <br /><br />';
					  			print '<a href="teams.php?action=teamedit&teamID='.$team['teamID'].'" class="textlink">Add members</a>';
							print '</div>';
						}
						elseif ($_GET['action'] == 'teamedit') {
							print '<div class="contentbox blank">';
								// check team admin
								$getAdmin = "SELECT userID FROM ttteam WHERE teamID =?";
								$admin = $mysqli->execute_query($getAdmin, [$_GET['teamID']])->fetch_assoc();
								if ($admin['userID'] != $_SESSION['userID']) print 'You do not have admin access to this team. <br />';
								else {
									$getTeam = "SELECT teamName, orgID, userID FROM ttteam WHERE teamID =?";
									$team = $mysqli->execute_query($getTeam, [$_GET['teamID']])->fetch_assoc();
									// team name and admin
									echo stripslashes($team['teamName']); print '<br />';
									print 'Admin - ';
									$getAdmin = "SELECT username, firstname, lastname FROM ttuser WHERE userID =?";
									$admin = $mysqli->execute_query($getAdmin, [$team['userID']])->fetch_assoc();
									echo $admin['username']; print ' (';
									echo stripslashes($admin['firstname']); print ' ';
									echo stripslashes($admin['lastname']); print ') <br />';
									if ($team['orgID'] > 0) { 
										$getOrg = "SELECT orgName FROM ttorg WHERE orgID =?";
										$org = $mysqli->execute_query($getOrg, [$team['orgID']])->fetch_assoc();
										print 'Organization - ';
										echo stripslashes($org['orgName']);
										print '<br />';
									}
									print '<br />';
									// form team name
									print '<form action="teams.php?action=teamupdate" method="post" onsubmit="disableButton()">
									<div class="fielddiv">
										<div class="fieldname">
											Name
										</div>
										<div class="fieldvalue">
											<input name="teamName" type="text" class="inputtext" maxlength="150" value="'.stripslashes($team['teamName']).'" placeholder="team name 150 chars max)" required />
										</div>
									</div>
									';
									print 'Members<br />';
									// org team members
									if ($team['orgID'] > 0) { 
										$getOrgMems = "SELECT userID FROM ttorg_mem WHERE orgID=?";
										$orgMems = $mysqli->execute_query($getOrgMems, [$team['orgID']])->fetch_all(MYSQLI_ASSOC);
										foreach($orgMems as $mem) {
											$getName = "SELECT username, firstname, lastname FROM ttuser WHERE userID=?";
											$name = $mysqli->execute_query($getName, [$mem['userID']])->fetch_assoc();
											$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
											$checkMem = $mysqli->execute_query($checkTeamMem, [$_GET['teamID'], $mem['userID']])->fetch_assoc();
				  							if (!empty($checkMem)) $checked = 'checked';
				  							else $checked = '';
				  							// checkbox input
				  							print '<input name="userID[]" type="checkbox" value='.$mem['userID'].' '.$checked.'>';
				  							echo $name['username']; print ' (';
				  							echo $name['firstname']; print ' ';
				  							echo $name['lastname']; print ')';
				  							print '<br />';
										}
							  			print '<br />';	
									}
									// stand alone team members
									else {
										$getTeamMems = "SELECT userID FROM ttteam_mem WHERE teamID=?";
										$teamMems = $mysqli->execute_query($getTeamMems, [$_GET['teamID']])->fetch_all(MYSQLI_ASSOC);
							  			foreach($teamMems as $mem) {
							  				$getName = "SELECT username, firstname, lastname FROM ttuser WHERE userID=?";
											$name = $mysqli->execute_query($getName, [$mem['userID']])->fetch_assoc();
				  							print '<input name="userID[]" type="checkbox" value='.$mem['userID'].' checked>';
				  							echo $name['username']; print ' (';
				  							echo $name['firstname']; print ' ';
				  							echo $name['lastname']; print ')';
				  							print '<br />';
							  			}
							  			// new stand alone team member
							 			print '<br />
							 			Add a new team member (email or username) <br /><br />
										<div class="fielddiv">
											<div class="fieldname">
												New member
											</div>
											<div class="fieldvalue">
												<input name="newMem" type="text" class="inputtext" placeholder="email or username" />
											</div>
										</div>
										';
									}
									print '<br /><input type="hidden" name="teamID" value="'.$_GET['teamID'].'" />
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
										</div>
									</div>
									</form>';
									//if ($team['orgID'] == 0) {
									//	print '<a href="teams.php?action=teamaddmem&teamID='.$_GET['teamID'].'" class="textlink">Add members</a><br /><br />';
									//}
								}
							print '</div>';
						}
						elseif ($_GET['action'] == 'teamupdate') {
							print '<div class="contentbox">';
								// update team name
				  				$stmt = $mysqli->prepare("UPDATE ttteam SET teamName=? WHERE teamID=?");
								$stmt->bind_param('si', $_POST['teamName'], $_POST['teamID']);
								$stmt->execute();
								$stmt->close();
								sleep(1);
								print 'Updated team <br />';
								$getTeam = "SELECT teamName, orgID, userID FROM ttteam WHERE teamID =?";
								$team = $mysqli->execute_query($getTeam, [$_POST['teamID']])->fetch_assoc();
								// team name
								echo stripslashes($team['teamName']); print '<br />';
								// update team members from an org
								if ($team['orgID'] > 0) {								
									$getOrgMems = "SELECT userID FROM ttorg_mem WHERE orgID=?";
									$orgMems = $mysqli->execute_query($getOrgMems, [$team['orgID']])->fetch_all(MYSQLI_ASSOC);
									foreach($orgMems as $orgMem) { 
										if ($orgMem['userID'] == $_SESSION['userID']) { 
											// leave admin
							  			}
							  			else {
							  				// check org member team status
							  				$teammem_check = 0;
							  				foreach ($_POST['userID'] as $memCheck) {
							  					if ($orgMem['userID'] == $memCheck) {
							  						$teammem_check = 1;
							  					}
							  				}
							  				if ($teammem_check == 0) { 
							  					//check if need to delete
							  					$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
												$checkMem = $mysqli->execute_query($checkTeamMem, [$_POST['teamID'], $orgMem['userID']])->fetch_assoc();
												if (!empty($checkMem)) {
													$stmt = $mysqli->prepare("DELETE FROM ttteam_mem WHERE teamID=? AND userID=?");
							  						$stmt->bind_param("ii", $_POST['teamID'], $orgMem['userID']);
							  						$stmt->execute();
							  						$stmt->close();
												}
							  				}
							  				else {
							  					// check if need to add
							  					$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
												$checkMem = $mysqli->execute_query($checkTeamMem, [$_POST['teamID'], $orgMem['userID']])->fetch_assoc();
												if (empty($checkMem)) {
													$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
				  									$stmt->bind_param("ii", $_POST['teamID'], $orgMem['userID']);
				  									$stmt->execute();
				  									$stmt->close();
												}
							  				}
							  			}
									}
								}
								// standalone team members update
								else {
									$getTeamMems = "SELECT userID FROM ttteam_mem WHERE teamID=?";
									$teamMems = $mysqli->execute_query($getTeamMems, [$_POST['teamID']])->fetch_all(MYSQLI_ASSOC);
							  		foreach($teamMems as $mem) {
							  			$teammem_check = 0;
							  			foreach ($_POST['userID'] as $memCheck) {
							  				if ($mem['userID'] == $memCheck) { 
							  					$teammem_check = 1;
							  				} 
							  			}
							  			if ($teammem_check == 0) {
						  					$stmt = $mysqli->prepare("DELETE FROM ttteam_mem WHERE teamID=? AND userID=?");
							  				$stmt->bind_param("ii", $_POST['teamID'], $mem['userID']);
							  				$stmt->execute();
							  				$stmt->close();
						  				}
							  		}
							  		// add new member
							  		if ($_POST['newMem'] != "") { 
							  			$getUser = "SELECT userID FROM ttuser WHERE username =? OR email =?";
										$user = $mysqli->execute_query($getUser, [$_POST['newMem'], $_POST['newMem']])->fetch_assoc();
										if (!empty($user)) {
							  				// check if already on team
							  				$checkTeamMem = "SELECT userID FROM ttteam_mem WHERE userID=? AND teamID=?";
											$teamMem = $mysqli->execute_query($checkTeamMem, [$user['userID'], $_POST['teamID']])->fetch_assoc();
											if (empty($teamMem)) {
								  				// insert new member
								  				$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
							  					$stmt->bind_param("ii", $_POST['teamID'], $user['userID']);
							  					$stmt->execute();
							  					$stmt->close();
							  					print '<br />New member added.';
							  				}
							  				else print '<br />New member is already on the team.';
							  			}
							  			else {
							  				print '<br />Your requested new member doesn\'t have an account so can\'t be added to the team. Please have them set up an account first.';
							  			}
							  		}
								}
							print '</div>';
						}						
					}
				?>
			</div>
			<!-- right column -->
			<div class="column">
				<?php 
				if (!isset($_SESSION['userID'])) {
					print '<div class="columnhead" style="padding:22px; margin-bottom:24px;">
						<a href="login.php" class="toollink"><span style="color:#C63232; font-size:24px">Log in to get started</span></a>
					</div>';
				}
				else {
					if (isset($_GET['action'])) {
						print '
						<div class="contentbox">
							<div class="contentboxtitle">Teams you manage</div>
							<div style="float:right"><button class="button150" onclick="window.location.href=\'teams.php?action=teamnew\';">New Team</button></div>
							<br />
							Click on a team to modify. 
							<br /><br />';
							$getTeams = $mysqli->query("SELECT * FROM ttteam WHERE userID=".$_SESSION['userID']."");
							if ($getTeams->num_rows > 0) {
								while ($teamsrow = $getTeams->fetch_array()) {
									print '<a href="teams.php?action=teamedit&teamID='.$teamsrow['teamID'].'" class="textlink">';
									if ($teamsrow['teamName'] != "") echo stripslashes($teamsrow['teamName']);
									else {print 'TeamID '; echo $teamsrow['teamID'];}
									print '</a><br />';
								}
							}
							print '
						</div>
						<div class="contentbox">
							<div class="contentboxtitle">Organizations you manage</div>
							<div style="float:right"><button class="button150" onclick="window.location.href=\'teams.php?action=orgnew\';">New Organization</button></div>
							<br />
							Click on an organization to modify. 
							<br />
							Organizations can have multiple teams.
							<br /><br />';
							$getOrgs = $mysqli->query("SELECT * FROM ttorg WHERE userID=".$_SESSION['userID']."");
							if ($getOrgs->num_rows > 0) {
								while ($orgsrow = $getOrgs->fetch_array()) {
									print '<a href="teams.php?action=orgedit&orgID='.$orgsrow['orgID'].'" class="textlink">';
									echo stripslashes($orgsrow['orgName']);
									print '</a><br />';
								}
							}
							print '
						</div>';
					}
				}
				?>
			</div>
		</div>
	</body>
</html>
<script>
    function disableButton() {
        var btn = document.getElementById('btn');
        btn.disabled = true;
        btn.innerText = 'Posting...'
    }
</script>
