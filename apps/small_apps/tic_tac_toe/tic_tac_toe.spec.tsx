import React, {act} from 'react';

import '@testing-library/jest-dom';

import {render} from '@testing-library/react';
import { screen } from 'shadow-dom-testing-library';

import springboard from 'springboard';
import {Springboard} from 'springboard/engine/engine';

import {makeMockCoreDependencies} from 'springboard/test/mock_core_dependencies';
import {Main} from 'springboard/platforms/browser';

import './tic_tac_toe';

describe('TicTacToe', () => {
    beforeEach(async () => {
        await setupTest();
    });

    afterEach(async () => {
        springboard.reset();
    });

    it('renders', async () => {
        expect(screen.getByTestId('cell-0-0')).toBeInTheDocument();
        expect(screen.getByTestId('cell-0-1')).toBeInTheDocument();
        expect(screen.getByTestId('cell-0-2')).toBeInTheDocument();
        expect(screen.getByTestId('cell-1-0')).toBeInTheDocument();
        expect(screen.getByTestId('cell-1-1')).toBeInTheDocument();
        expect(screen.getByTestId('cell-1-2')).toBeInTheDocument();
        expect(screen.getByTestId('cell-2-0')).toBeInTheDocument();
        expect(screen.getByTestId('cell-2-1')).toBeInTheDocument();
        expect(screen.getByTestId('cell-2-2')).toBeInTheDocument();
    });

    it('marks x on first click', async () => {
        await act(async () => {
            screen.getByTestId('cell-0-0').click();
        });

        expect(screen.getByTestId('cell-0-0')).toHaveTextContent('X');
    });

    it('marks o on second click', async () => {
        await act(async () => {
            screen.getByTestId('cell-0-0').click();
            screen.getByTestId('cell-0-1').click();
        });

        expect(screen.getByTestId('cell-0-0')).toHaveTextContent('X');
        expect(screen.getByTestId('cell-0-1')).toHaveTextContent('O');
    });

    it('ends game when a row is completed', async () => {
        await act(async () => {
            screen.getByTestId('cell-0-0').click();
            screen.getByTestId('cell-0-1').click();
            screen.getByTestId('cell-1-0').click();
            screen.getByTestId('cell-1-1').click();
            screen.getByTestId('cell-2-0').click();
        });

        expect(screen.getByTestId('cell-0-0')).toHaveTextContent('X');
        expect(screen.getByTestId('cell-0-1')).toHaveTextContent('O');
        expect(screen.getByTestId('cell-1-0')).toHaveTextContent('X');
        expect(screen.getByTestId('cell-1-1')).toHaveTextContent('O');
        expect(screen.getByTestId('cell-2-0')).toHaveTextContent('X');

        expect(screen.getByTestId('winner')).toHaveTextContent('X wins!');
    });

    it('clicking the same square multiple times results in no change', async () => {
        await act(async () => {
            screen.getByTestId('cell-0-0').click();
        });

        expect(screen.getByTestId('cell-0-0')).toHaveTextContent('X');

        await act(async () => {
            screen.getByTestId('cell-0-0').click();
        });

        expect(screen.getByTestId('cell-0-0')).toHaveTextContent('X');
    });
});

const setupTest = async (): Promise<Springboard> => {
    const coreDeps = makeMockCoreDependencies({store: {}});

    const engine = new Springboard(coreDeps, {});

    render(
        <Main
            engine={engine}
        />
    );

    await act(async () => {
        await new Promise(r => setTimeout(r, 10));
    });
    await new Promise(r => setTimeout(r, 10));

    return engine;
};
