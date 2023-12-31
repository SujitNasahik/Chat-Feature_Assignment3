import React, { useState, useEffect } from "react";
import Formula from "./Formula";
import Status from "./Status";
import KeyPad from "./KeyPad";
import SpreadSheetClient from "../Engine/SpreadSheetClient";
import SheetHolder from "./SheetHolder";
import './SpreadSheet.css';

import { ButtonNames } from "../Engine/GlobalDefinitions";
import ServerSelector from "./ServerSelector";
import GameNumbers from "./GameNumbers";
import ChatClient from "./ChatClient";

interface SpreadSheetProps {
  documentName: string;
  spreadSheetClient: SpreadSheetClient;
  chatClient: ChatClient;
}

/**
 * the main component for the Spreadsheet.  It is the parent of all the other components
 * 
 *
 * */

// create the client that talks to the backend.

function SpreadSheet({ documentName, spreadSheetClient, chatClient }: SpreadSheetProps) {
  const [formulaString, setFormulaString] = useState(spreadSheetClient.getFormulaString())
  const [resultString, setResultString] = useState(spreadSheetClient.getResultString())
  const [cells, setCells] = useState(spreadSheetClient.getSheetDisplayStringsForGUI());
  const [statusString, setStatusString] = useState(spreadSheetClient.getEditStatusString());
  const [currentCell, setCurrentCell] = useState(spreadSheetClient.getWorkingCellLabel());
  const [currentlyEditing, setCurrentlyEditing] = useState(spreadSheetClient.getEditStatus());
  const [userName, setUserName] = useState(window.sessionStorage.getItem('userName') || "");
  const [serverSelected, setServerSelected] = useState("localhost");
  const [isGameModeActive, setIsGameModeActive] = useState(false);
  const gameNumbers = spreadSheetClient.getGameNumbers();
   
  const targetNumber = 24; // Replace with dynamic target number
  //const [gameNumbers2, setGameNumbers2] = useState<number[]>([]);

  function updateDisplayValues(): void {
    spreadSheetClient.userName = userName;
    spreadSheetClient.documentName = documentName;
    setFormulaString(spreadSheetClient.getFormulaString());
    setResultString(spreadSheetClient.getResultString());
    setStatusString(spreadSheetClient.getEditStatusString());
    setCells(spreadSheetClient.getSheetDisplayStringsForGUI());
    setCurrentCell(spreadSheetClient.getWorkingCellLabel());
    setCurrentlyEditing(spreadSheetClient.getEditStatus());
    const errorOccurred = spreadSheetClient.getErrorOccurred();
    if (errorOccurred !== "") {
      alert(errorOccurred)
    }
    updateGameMode();
    if ( spreadSheetClient.getGameMode() && spreadSheetClient.getGameFormulaString() !== '') {
      chatClient.sendMessage(userName, spreadSheetClient.getGameFormulaString());
      spreadSheetClient.updateGameFormulas(spreadSheetClient.getGameFormulaString());
    }

  }

  // useEffect to refetch the data every 1/20 of a second
  useEffect(() => {
    const interval = setInterval(() => {
      updateDisplayValues();
    }, 50);
    return () => clearInterval(interval);
  });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (currentlyEditing) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes! Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentlyEditing]);


  
  /*
  useEffect(() => {
    if (isGameModeActive) {
      // Generate the numbers when the game mode is activated
      const newGameNumbers = spreadSheetClient.generateNumbersAndOperationsFor24();
      setGameNumbers2(newGameNumbers);
    }
  }, [isGameModeActive]);*/

  function returnToLoginPage() {

    // set the document name
    spreadSheetClient.documentName = documentName;
    // reload the page

    // the href needs to be updated.   Remove /<sheetname> from the end of the URL
    const href = window.location.href;
    const index = href.lastIndexOf('/');
    let newURL = href.substring(0, index);
    newURL = newURL + "/documents";
    window.history.pushState({}, '', newURL);
    window.location.reload();

  }

  function checkUserName(): boolean {
    if (userName === "") {
      alert("Please enter a user name");
      return false;
    }
    return true;
  }

  function updateGameMode(): void {
    const gameMode = spreadSheetClient.getGameMode();
    setIsGameModeActive(gameMode);
  }

  /**
   * 
   * @param event 
   * 
   * This function is the call back for the command buttons
   * 
   * It will call the machine to process the command button
   * 
   * the buttons done, edit, clear, all clear, and restart do not require asynchronous processing
   * 
   * the other buttons do require asynchronous processing and so the function is marked async
   */
  async function onCommandButtonClick(text: string): Promise<void> {

    if (!checkUserName()) {
      return;
    }

    switch (text) {


      case ButtonNames.edit_toggle:
        if (currentlyEditing) {
          spreadSheetClient.setEditStatus(false);
        } else {
          spreadSheetClient.setEditStatus(true);
        }
        setStatusString(spreadSheetClient.getEditStatusString());
        break;

      case ButtonNames.clear:
        spreadSheetClient.removeToken();
        break;

      case ButtonNames.allClear:
        spreadSheetClient.clearFormula();
        break;

      case ButtonNames.activateGameMode:
        if (userName === "gameHost") {
        spreadSheetClient.setGameMode();
          break;
        } else {
        /*
        const newGameNumbers = spreadSheetClient.getGameNumbers();
        setGameNumbers2(newGameNumbers);*/
        break;
        }
      
      case ButtonNames.deactivateGameMode:
        if (userName === "gameHost") {
          spreadSheetClient.closeGameMode();
            break;
          } else {
        break;
          }

    }
    // update the display values
    updateDisplayValues();
  }

  /**
   *  This function is the call back for the number buttons and the Parenthesis buttons
   * 
   * They all automatically start the editing of the current formula.
   * 
   * @param event
   * 
   * */
  function onButtonClick(event: React.MouseEvent<HTMLButtonElement>): void {
    if (!checkUserName()) {
      return;
    }
    const text = event.currentTarget.textContent;
    let trueText = text ? text : "";
    spreadSheetClient.setEditStatus(true);
    spreadSheetClient.addToken(trueText);

    updateDisplayValues();

  }

  // this is to help with development,  it allows us to select the server
  function serverSelector(buttonName: string) {
    setServerSelected(buttonName);
    spreadSheetClient.setServerSelector(buttonName);
  }


  /**
   * 
   * @param event 
   * 
   * This function is called when a cell is clicked
   * If the edit status is true then it will send the token to the machine.
   * If the edit status is false then it will ask the machine to update the current formula.
   */
  function onCellClick(event: React.MouseEvent<HTMLButtonElement>): void {

    if (userName === "") {
      alert("Please enter a user name");
      return;
    }
    const cellLabel = event.currentTarget.getAttribute("cell-label");
    // calculate the current row and column of the clicked on cell

    const editStatus = spreadSheetClient.getEditStatus();
    let realCellLabel = cellLabel ? cellLabel : "";


    // if the edit status is true then add the token to the machine
    if (editStatus) {
      spreadSheetClient.addCell(realCellLabel);  // this will never be ""
      updateDisplayValues();
    }
    // if the edit status is false then set the current cell to the clicked on cell
    else {
      spreadSheetClient.requestViewByLabel(realCellLabel);
      updateDisplayValues();
    }

  }

  function onNumberOrOperationSelect(value: string): void {
    if (isGameModeActive) {
      console.log("Adding value to formula:", value);
      spreadSheetClient.addToken(value); // Add the value to the formula
      setCurrentlyEditing(true); 
      
      const newFormula = formulaString + value;
      console.log("New formula:", newFormula);
      setFormulaString(newFormula); // Update the formula
      updateDisplayValues(); // Update the display values to reflect changes
    } 
  }

  return (
    <div>

{isGameModeActive ? (
    <button  className="activateGameModeButton" onClick={() => onCommandButtonClick(ButtonNames.deactivateGameMode)}>
      Deactivate Game Mode
    </button>
  ) : (
    <button className="activateGameModeButton" onClick={() => onCommandButtonClick(ButtonNames.activateGameMode)}>
      Activate Game Mode
    </button>
  )}
      <Status statusString={statusString} userName={userName}></Status>
      <button onClick={returnToLoginPage}>Return to Login Page</button>
      {isGameModeActive ? (
        // Render game-specific components
        <div className="gameMode">
        <GameNumbers 
          numbers={gameNumbers} 
          target={targetNumber} 
          onNumberOrOperationSelect={onNumberOrOperationSelect} 
          onCommandButtonClick={onCommandButtonClick}
        />
        {/* Render Formula and Result using spreadSheetClient data */}
        <Formula formulaString={formulaString} resultString={resultString} />
        <SheetHolder cellsValues={cells}
            onClick={onCellClick}
            currentCell={currentCell}
            currentlyEditing={currentlyEditing} />
        </div>
      ) : (
        // Render regular spreadsheet components
        <div className="spreadsheetMode">
          <Formula formulaString={formulaString} resultString={resultString} />
          <SheetHolder cellsValues={cells}
            onClick={onCellClick}
            currentCell={currentCell}
            currentlyEditing={currentlyEditing} />
          <KeyPad onButtonClick={onButtonClick}
            onCommandButtonClick={onCommandButtonClick}
            currentlyEditing={currentlyEditing} />
        </div>
      )}
      <ServerSelector serverSelector={serverSelector} serverSelected={serverSelected} />
     
    </div>
  )
};

export default SpreadSheet;