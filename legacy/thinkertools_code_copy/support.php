<?php session_start();
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools support</title>
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
				<div class="contentbox">
					<div class="contentboxtitle">
						General Thinkertools Support
					</div>
					<br />
					Contact us at admin@thinkertools.org for any help needed.
					<br /><br />
					<strong>How do I use Thinkertools?</strong><br />
					Thinkertools has two platforms that can be used in educational settings like a classroom, in a research team, or on your own! Start any of these games by creating a new session or game, or joining an existing one. The goal is to have fun, learn something new, and create new knowledge. 
					<br /><br />
					<strong>Do you need a Thinkertools account to use the tools?</strong><br />
					Yes, to access the tools you need to be signed into your thinkertools account. You can create one by clicking Login in the main menu.
					<br /><br />
					<strong>Does Thinkertools cost to use?</strong><br />
					No, Thinkertools is completely free. 
					<br /><br />
					<strong>Can I donate to Thinkertools or help in other ways?</strong><br />
					Yes, we are a 501c3 US nonprofit, CA charitable organization, so all donations are tax deductible. 100% of donations help fund our operations. To donate now, go to our secure <a href="https://www.paypal.com/donate/?hosted_button_id=SYJYLMD3BNSAY" class="textlink">PayPal donation page</a> (credit/debit cards accepted too). For other ways to donate, please contact us at info@thinkertools.org. 
					<br /><br />
					<strong>How do I change my profile information?</strong><br />
					All personal information is available to be modified under the profile tab in the user bar (click where you see your name in the top right corner). If you change your username/ email/ password, the data connected to your account will remain. The only information that other Thinkertools users see is your name. 
					<br /><br />
					<strong>How do I use the different tools?</strong><br />
					Great question! Check out the demos to see played examples of both of the current tools with additional instructions. If you are still uncertain, feel free to message Thinkertools support with your inquiry and we will help you.
					<br /><br />
					<strong>How do I invite people to Thinkertools?</strong><br />
					There are a couple ways to get your friends and team members to sign up for Thinkertools. You can send them the link to the Login page. Or you can have them join a team directly by adding their email to the team or organization. They will receive a link from admin@thinkertools.org with the invitation to join. If they cannot find it, check spam. The last way is to spread the word! Tell your friends, family, classmates, and coworkers. 
					<br /><br />
					<strong>Do I need to be a member of a Team?</strong><br />
					Session or games require a team, however, one person can be a team, so you can play solo! To keep track of the teams you are apart of, and what games you’ve played with them, look at the teams and history tabs under your name in the main menu.
					<br /><br />
					<strong>How can I join a team?</strong><br />
					You can create your own team with other Thinkertools account holders by adding them to a team or invite new friends through their emails! 
					<br /><br />
					<strong>Can I delete a game, session, or account?</strong><br />
					Currently you can't delete a game, session, or account, please contact support at the email above for help.
					<br /><br />
					<strong>How do I report offensive, false, or suspicious entries?</strong><br />
					Please contact support at admin@thinkertools.org with the specific issue. We will respond as quickly as possible. 	
				</div>
			</div>
			<div class="column">
				<div class="toolbox woi" style="margin-top: 24px;">
					<a href="webofinquiry/home.php" class="toollink">Web of Inquiry</a>
				</div>
				<div class="contentbox">
					<?php 
						if ($_GET['action'] == "woi") {
							print ' 
								<div style="float:right"><a href="support.php" class="textlink">Close</a></div>
								<br />
								<strong>What do I use the WOI for?</strong><br />
								Web of Inquiry is a library of inquiry games designed to help your team answer a question. Like any game, an inquiry game consists of an objective, rules, and moves, with everyone on the team taking turns. You can design your own inquiry game. 
								<br /><br />
								<strong>How do I use the WOI?</strong><br />
								Each game is going to have a different set of rules and moves made by the person creating the game, so read carefully and ask questions if needed. We recommend going through the demo before beginning to play a game so that you become familiar with the setup. 
								<br /><br />
								<strong>What\'s an example of an inquiry game?</strong><br />
								A game  is the general game objective (like creating a well-formed list) and the set of rules and moves (like all list items must be relevant, and add, delete, split, or modify an item) to accomplish the objective. An inquiry game uses a game template to answer a specific inquiry question, such as using the list game to answer "What are the major kinds of climate change evidence?" 
								<br /><br />
								<strong>What does the game grid show?</strong><br />
								The games allows you to see where your game falls in relation to others that have been made. Check out the nearest game for helpful facts or additional questions. 
								<br /><br />
								<strong>Can I join any game?</strong><br />
								If the game is public and ongoing you are more than welcome to join it by contact us at info@thinkertools.org and we will send the game admin a message. Published yet private games and games that have concluded are available for you to see and replicate if you want to play the game yourself. Check out the grid for your next game.
								<br /><br />
								<strong>What’s the difference between public and private games?</strong><br />
								Private games will only be able to be played by the team members that the creator adds at the beginning. Once the private game is complete, the creator will have a chance to publish their game, so that others can learn from the work they’ve done. Public games are available to anyone to join in, and will automatically be published when finished. At Thinkertools, we encourage the spread of knowledge, so when possible we suggest a public game or a published private game.
							';
						}
						else print '<a href="support.php?action=woi" class="textlink">See FAQs</a>';
					?>
				</div>
				<br />
				<div class="toolbox quipx">
					<a href="quipx/home.php" class="toollink">Quipx</a>
				</div>
				<div class="contentbox">
					<?php 
						if ($_GET['action'] == "quipx") {
							print ' 
								<div style="float:right"><a href="support.php" class="textlink">Close</a></div>
								<br />
								<strong>What is Quipx for?</strong><br />
								Quipx is a tool used to help plan, reflect, and improve on group or team discussion. 
								<br /><br />
								<strong>How can I use Quipx?</strong><br />
								The team member who sets up the session enters the objectives that are to be accomplished in the meeting. After the discussion, each member participates and reflects on the success of the meeting. If you are unsure about how the Quipx games works please check out the demo which takes you through an example discussion. If you have any more questions contact us at info@thinkertools.org
								<br /><br />
								<strong>Can I be in multiple sessions at the same time?</strong><br />
								You can be active in only one session at a time.
								<br /><br />
								<strong>Do I need to be a part of a team?</strong><br />
								For Quipx, you need a team to be able to use this tool. Join up with some friends, classmates, work colleagues, or other Thinkertools users, and start discussing under the Teams link when you have logged in. 
								<br /><br />
								<strong>Can I be a part of multiple teams?</strong><br />
								As long as the person has a Thinkertools account, they can be apart of as many teams as they wish. You can also be part of an organization, which allows for multiple teams.
							';
						}
						else print '<a href="support.php?action=quipx" class="textlink">See FAQs</a>';
					?>
				</div>
			</div>
		</div>
	</body>
</html>
