import React from 'react';

import springboard from 'springboard';

console.log('hi mom')

import './tic_tac_toe.css';

type Cell = 'X' | 'O' | null;
type Board = Cell[][];

type Winner = 'X' | 'O' | 'stalemate' | null;

type Score = {
    X: number;
    O: number;
    stalemate: number;
};

const initialBoard: Board = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
];

const checkForWinner = (board: Board): Winner => {
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    const flatBoard = board.flat();

    const winner = winningCombinations.find(([a, b, c]) =>
        flatBoard[a] && flatBoard[a] === flatBoard[b] && flatBoard[a] === flatBoard[c]
    );

    if (winner) {
        return flatBoard[winner[0]];
    }

    if (flatBoard.every(Boolean)) {
        return 'stalemate';
    }

    return null;
};

springboard.registerModule('TicTacToe', {}, async (moduleAPI) => {
    const boardState = await moduleAPI.statesAPI.createPersistentState<Board>('board_v5', initialBoard);
    const winnerState = await moduleAPI.statesAPI.createPersistentState<Winner>('winner', null);
    const scoreState = await moduleAPI.statesAPI.createPersistentState<Score>('score', {X: 0, O: 0, stalemate: 0});

    const actions = moduleAPI.createActions({
        clickedCell: async (args: {row: number, column: number}) => {
            if (winnerState.getState()) {
                return;
            }

            const board = boardState.getState();

            if (board[args.row][args.column]) {
                return;
            }

            const numPreviousMoves = board.flat().filter(Boolean).length;
            const xOrO = numPreviousMoves % 2 === 0 ? 'X' : 'O';

            const updatedBoard = boardState.setStateImmer(board => {
                board[args.row][args.column] = xOrO;
            });

            const winner = checkForWinner(updatedBoard);
            if (winner) {
                winnerState.setState(winner);

                scoreState.setStateImmer(score => {
                    score[winner] += 1;
                });
            }
        },
        onNewGame: async () => {
            boardState.setState(initialBoard);
            winnerState.setState(null);
        },
    });

    moduleAPI.registerRoute('/', {documentMeta: async () => ({
        title: 'Tic Tac Toe! Yeah!',
        description: 'A simple tic-tac-toe game',
    })}, () => {
        return (
            <TicTacToeBoard
                board={boardState.useState()}
                clickedCell={actions.clickedCell}
                winner={winnerState.useState()}
                onNewGame={actions.onNewGame}
                score={scoreState.useState()}
            />
        );
    });
});

type TicTacToeBoardProps = {
    board: Board;
    clickedCell: (args: {row: number, column: number}) => void;
    winner: Winner;
    onNewGame: () => void;
    score: Score;
}

const TicTacToeBoard = (props: TicTacToeBoardProps) => {
    return (
        <div>
            <table>
                <tbody>
                    {props.board.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {row.map((cell, cellIndex) => (
                                <td
                                    key={cellIndex}
                                    className={cell ? 'filled' : ''}
                                    data-testid={`cell-${rowIndex}-${cellIndex}`}
                                    onClick={() => props.clickedCell({row: rowIndex, column: cellIndex})}
                                >
                                    {cell ? <span>{cell}</span> : <span></span>}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {props.winner && (
                <>
                    <p>{props.winner === 'stalemate' ? 'Stalemate!' : `${props.winner} wins!`}</p>
                    <button onClick={() => props.onNewGame()}>New game</button>
                </>
            )}

            <ul>
                <li>X: {props.score.X}</li>
                <li>O: {props.score.O}</li>
                <li>Stalemate: {props.score.stalemate}</li>
            </ul>
        </div>
    );
};
